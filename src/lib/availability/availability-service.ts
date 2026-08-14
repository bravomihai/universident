import type { Prisma } from "@/generated/prisma/client";
import {
  AppointmentStatus,
  StudentAvailabilitySeriesStatus,
  StudentAvailabilitySlotStatus,
} from "@/generated/prisma/enums";
import type {
  parseCancelAvailabilityInput,
  parseCreateAvailabilityInput,
  parseUpdateAvailabilityInput,
} from "@/lib/availability/availability-input";
import {
  localDateForInstant,
  localDateToPrismaDate,
} from "@/lib/availability/bucharest-time";
import { materializeSeriesThrough } from "@/lib/availability/materializer";
import { defaultMaterializationDate } from "@/lib/availability/recurrence";
import { prisma } from "@/lib/prisma";

type SuccessData<T> = T extends { ok: true; data: infer Data } ? Data : never;
type Parsed<T extends (value: unknown) => unknown> = SuccessData<ReturnType<T>>;

export type AvailabilityDomainErrorCode =
  | "RESOURCE_NOT_FOUND"
  | "SLOT_NOT_FOUND"
  | "SLOT_ALREADY_STARTED"
  | "SLOT_OCCUPIED_REASON_REQUIRED"
  | "STALE_VERSION"
  | "INVALID_INTERVAL"
  | "CONFLICT";

export class AvailabilityDomainError extends Error {
  constructor(readonly code: AvailabilityDomainErrorCode, message: string) {
    super(message);
  }
}

const activeAppointmentStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

const slotInclude = {
  studentLocation: { include: { city: true } },
  offerings: {
    where: { removedAt: null },
    include: {
      studentTreatment: { include: { treatment: true } },
      supervisor: true,
    },
    orderBy: { studentTreatment: { treatment: { name: "asc" as const } } },
  },
  series: true,
  appointments: {
    where: { status: { in: activeAppointmentStatuses } },
    include: {
      patientProfile: {
        select: {
          id: true,
          profileSlug: true,
          user: {
            select: {
              id: true,
              name: true,
              reviewsReceived: {
                where: { publishedAt: { not: null } },
                select: { rating: true },
              },
            },
          },
        },
      },
    },
    orderBy: { scheduledStartsAt: "asc" as const },
  },
} satisfies Prisma.StudentAvailabilitySlotInclude;

type OfferingInput = { studentTreatmentId: string; supervisorId: string };

async function validateConfiguration(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  studentLocationId: string,
  offerings: OfferingInput[],
) {
  const [location, treatments, supervisors] = await Promise.all([
    transaction.studentLocation.findFirst({
      where: { id: studentLocationId, studentProfileId, deletedAt: null, city: { isActive: true } },
      select: { id: true },
    }),
    transaction.studentTreatment.findMany({
      where: {
        id: { in: offerings.map((item) => item.studentTreatmentId) },
        studentProfileId,
        deletedAt: null,
        treatment: { isActive: true },
      },
      select: { id: true },
    }),
    transaction.studentSupervisor.findMany({
      where: {
        id: { in: offerings.map((item) => item.supervisorId) },
        studentProfileId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);
  if (
    !location ||
    treatments.length !== offerings.length ||
    supervisors.length !== new Set(offerings.map((item) => item.supervisorId)).size
  ) {
    throw new AvailabilityDomainError(
      "RESOURCE_NOT_FOUND",
      "Locația, tratamentele sau supervizorii selectați nu mai sunt disponibili.",
    );
  }
}

function assertFuture(startsAt: Date) {
  if (startsAt <= new Date()) {
    throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Disponibilitatea trebuie să înceapă în viitor.");
  }
}

function isTemporalConflict(error: unknown) {
  const text = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return text.includes("student_availability_slot_active_owner_time_excl");
}

async function resolveActiveAppointments(
  transaction: Prisma.TransactionClient,
  appointments: Array<{ id: string; status: AppointmentStatus; version: number }>,
  reason: string | null,
  actorUserId: string,
  now: Date,
) {
  if (appointments.length > 0 && !reason) {
    throw new AvailabilityDomainError(
      "SLOT_OCCUPIED_REASON_REQUIRED",
      "Intervalul conține cereri sau programări. Scrie motivul anulării înainte de a continua.",
    );
  }
  for (const appointment of appointments) {
    const pending = appointment.status === AppointmentStatus.PENDING;
    await transaction.appointment.update({
      where: { id: appointment.id, version: appointment.version },
      data: {
        status: pending ? AppointmentStatus.REJECTED : AppointmentStatus.CANCELLED_BY_STUDENT,
        statusReason: reason,
        statusReasonCode: pending ? "AVAILABILITY_CHANGED" : "STUDENT_AVAILABILITY_CHANGED",
        statusChangedAt: now,
        statusChangedByUserId: actorUserId,
        rejectedAt: pending ? now : undefined,
        cancelledAt: pending ? undefined : now,
        version: { increment: 1 },
      },
    });
  }
}

export async function getStudentAvailabilityCatalog(studentProfileId: string) {
  const [locations, treatments, supervisors] = await Promise.all([
    prisma.studentLocation.findMany({
      where: { studentProfileId, deletedAt: null, city: { isActive: true } },
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, address: true, city: { select: { name: true } } },
    }),
    prisma.studentTreatment.findMany({
      where: { studentProfileId, deletedAt: null, treatment: { isActive: true } },
      orderBy: { treatment: { name: "asc" } },
      select: {
        id: true,
        durationMinutes: true,
        treatment: { select: { name: true, slug: true } },
      },
    }),
    prisma.studentSupervisor.findMany({
      where: { studentProfileId, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, academicTitle: true },
    }),
  ]);
  return { locations, treatments, supervisors };
}

export async function listStudentAvailability(studentProfileId: string, from: Date, to: Date) {
  if (to <= from || to.getTime() - from.getTime() > 370 * 86_400_000) {
    throw new AvailabilityDomainError("INVALID_INTERVAL", "Intervalul calendarului nu este valid.");
  }
  await prisma.$transaction(async (transaction) => {
    const series = await transaction.studentAvailabilitySeries.findMany({
      where: { studentProfileId, status: StudentAvailabilitySeriesStatus.ACTIVE },
      include: { offerings: true },
    });
    for (const item of series) {
      await materializeSeriesThrough(transaction, item, localDateForInstant(to));
    }
  });
  return prisma.studentAvailabilitySlot.findMany({
    where: {
      studentProfileId,
      status: StudentAvailabilitySlotStatus.ACTIVE,
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    orderBy: { startsAt: "asc" },
    include: slotInclude,
  });
}

export async function createAvailability(
  studentProfileId: string,
  input: Parsed<typeof parseCreateAvailabilityInput>,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await validateConfiguration(transaction, studentProfileId, input.studentLocationId, input.offerings);
      if (input.kind === "SINGLE") {
        assertFuture(input.startsAt);
        return transaction.studentAvailabilitySlot.create({
          data: {
            studentProfileId,
            studentLocationId: input.studentLocationId,
            originalStartsAt: input.startsAt,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            offerings: {
              create: input.offerings.map((item) => ({ studentProfileId, ...item })),
            },
          },
          include: slotInclude,
        });
      }

      const series = await transaction.studentAvailabilitySeries.create({
        data: {
          studentProfileId,
          studentLocationId: input.studentLocationId,
          startsOn: localDateToPrismaDate(input.rule.startsOn)!,
          startMinuteOfDay: input.rule.startMinuteOfDay,
          weekdays: input.rule.weekdays,
          intervalWeeks: input.rule.intervalWeeks,
          durationMinutes: input.rule.durationMinutes,
          endMode: input.rule.endMode,
          endsOn: input.rule.endsOn ? localDateToPrismaDate(input.rule.endsOn) : null,
          occurrenceCount: input.rule.occurrenceCount,
          offerings: {
            create: input.offerings.map((item) => ({ studentProfileId, ...item })),
          },
        },
        include: { offerings: true },
      });
      const materialized = await materializeSeriesThrough(transaction, series, defaultMaterializationDate());
      if (!materialized.occurrences.some((item) => item.startsAt > new Date())) {
        throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Seria trebuie să conțină cel puțin o apariție viitoare.");
      }
      return series;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError("CONFLICT", "Intervalul se suprapune peste o altă disponibilitate.");
    }
    throw error;
  }
}

export async function updateAvailability(
  studentProfileId: string,
  actorUserId: string,
  slotId: string,
  input: Parsed<typeof parseUpdateAvailabilityInput>,
) {
  assertFuture(input.startsAt);
  try {
    return await prisma.$transaction(async (transaction) => {
      const slot = await transaction.studentAvailabilitySlot.findFirst({
        where: { id: slotId, studentProfileId },
        include: {
          appointments: { where: { status: { in: activeAppointmentStatuses } } },
          offerings: { where: { removedAt: null } },
        },
      });
      if (!slot) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Intervalul nu a fost găsit.");
      if (slot.version !== input.expectedVersion) {
        throw new AvailabilityDomainError("STALE_VERSION", "Calendarul s-a modificat. Reîncarcă pagina.");
      }
      if (slot.status !== StudentAvailabilitySlotStatus.ACTIVE || slot.startsAt <= new Date()) {
        throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Intervalul nu mai poate fi editat.");
      }
      const now = new Date();
      await validateConfiguration(transaction, studentProfileId, input.studentLocationId, input.offerings);
      await resolveActiveAppointments(transaction, slot.appointments, input.appointmentReason, actorUserId, now);

      if (slot.appointments.length === 0) {
        await transaction.studentAvailabilitySlotOffering.deleteMany({ where: { slotId: slot.id } });
      } else {
        await transaction.studentAvailabilitySlotOffering.updateMany({
          where: { slotId: slot.id, removedAt: null },
          data: { removedAt: now },
        });
      }
      return transaction.studentAvailabilitySlot.update({
        where: { id: slot.id, version: slot.version },
        data: {
          studentLocationId: input.studentLocationId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isException: slot.seriesId !== null || slot.isException,
          version: { increment: 1 },
          offerings: {
            create: input.offerings.map((item) => ({ studentProfileId, ...item })),
          },
        },
        include: slotInclude,
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError("CONFLICT", "Intervalul editat se suprapune peste altă disponibilitate.");
    }
    throw error;
  }
}

export async function cancelAvailability(
  studentProfileId: string,
  actorUserId: string,
  slotId: string,
  input: Parsed<typeof parseCancelAvailabilityInput>,
) {
  return prisma.$transaction(async (transaction) => {
    const slot = await transaction.studentAvailabilitySlot.findFirst({
      where: { id: slotId, studentProfileId },
      include: { series: true },
    });
    if (!slot) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Intervalul nu a fost găsit.");
    if (slot.version !== input.expectedVersion) {
      throw new AvailabilityDomainError("STALE_VERSION", "Calendarul s-a modificat. Reîncarcă pagina.");
    }
    const now = new Date();
    if (slot.startsAt <= now) {
      throw new AvailabilityDomainError(
        "SLOT_ALREADY_STARTED",
        "Un interval care a început nu mai poate fi șters din calendar.",
      );
    }
    const where = input.scope === "SERIES" && slot.seriesId
      ? { seriesId: slot.seriesId, status: StudentAvailabilitySlotStatus.ACTIVE, startsAt: { gt: now } }
      : { id: slot.id, status: StudentAvailabilitySlotStatus.ACTIVE };
    const affected = await transaction.studentAvailabilitySlot.findMany({
      where,
      include: { appointments: { where: { status: { in: activeAppointmentStatuses } } } },
    });
    const appointments = affected.flatMap((item) => item.appointments);
    await resolveActiveAppointments(transaction, appointments, input.appointmentReason, actorUserId, now);

    const occupiedIds = affected.filter((item) => item.appointments.length > 0).map((item) => item.id);
    const emptyIds = affected.filter((item) => item.appointments.length === 0).map((item) => item.id);
    if (occupiedIds.length > 0) {
      await transaction.studentAvailabilitySlot.updateMany({
        where: { id: { in: occupiedIds } },
        data: { status: StudentAvailabilitySlotStatus.CANCELLED, cancelledAt: now, isException: true, version: { increment: 1 } },
      });
    }
    if (input.scope === "OCCURRENCE" && slot.seriesId && emptyIds.length > 0) {
      await transaction.studentAvailabilitySlot.updateMany({
        where: { id: { in: emptyIds } },
        data: { status: StudentAvailabilitySlotStatus.CANCELLED, cancelledAt: now, isException: true, version: { increment: 1 } },
      });
    } else if (emptyIds.length > 0) {
      await transaction.studentAvailabilitySlot.deleteMany({ where: { id: { in: emptyIds } } });
    }
    if (input.scope === "SERIES" && slot.series) {
      if (slot.series.revision !== input.expectedSeriesRevision) {
        throw new AvailabilityDomainError("STALE_VERSION", "Seria s-a modificat. Reîncarcă pagina.");
      }
      await transaction.studentAvailabilitySeries.update({
        where: { id: slot.series.id, revision: slot.series.revision },
        data: { status: StudentAvailabilitySeriesStatus.CANCELLED, revision: { increment: 1 } },
      });
    }
    return { cancelledSlots: affected.length };
  }, { isolationLevel: "Serializable" });
}
