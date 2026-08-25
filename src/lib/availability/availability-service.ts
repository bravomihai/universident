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
  bucharestPartsForInstant,
  localDateForInstant,
  localDateToPrismaDate,
  minuteOfDayForBucharestInstant,
} from "@/lib/availability/bucharest-time";
import {
  MAX_ACTIVE_SERIES_PER_STUDENT,
  MAX_EXISTING_SLOTS_PER_SERIES_WINDOW,
  rollingMaterializationThrough,
  validateStudentCalendarRange,
} from "@/lib/availability/limits";
import {
  MaterializationDomainError,
  ensureStudentSeriesMaterializedThrough,
  materializeSeriesThrough,
} from "@/lib/availability/materializer";
import { appointmentConsumesCapacityWhere } from "@/lib/appointments/appointment-service";
import { prisma } from "@/lib/prisma";
import {
  availabilityRootLockKey,
  locationResourceLockKey,
  lockSchedulingKeys,
  studentCalendarLockKey,
  supervisorResourceLockKey,
  treatmentResourceLockKey,
} from "@/lib/scheduling/locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

type SuccessData<T> = T extends { ok: true; data: infer Data } ? Data : never;
type Parsed<T extends (value: unknown) => unknown> = SuccessData<ReturnType<T>>;

export type AvailabilityDomainErrorCode =
  | "RESOURCE_NOT_FOUND"
  | "SLOT_NOT_FOUND"
  | "SLOT_ALREADY_STARTED"
  | "SLOT_OCCUPIED_REASON_REQUIRED"
  | "SERIES_NOT_FOUND"
  | "STALE_VERSION"
  | "INVALID_INTERVAL"
  | "LIMIT_EXCEEDED"
  | "CONFLICT";

export class AvailabilityDomainError extends Error {
  constructor(readonly code: AvailabilityDomainErrorCode, message: string) {
    super(message);
  }
}

function slotInclude(now: Date) {
  return {
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
      where: appointmentConsumesCapacityWhere(now),
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
}

type OfferingInput = { studentTreatmentId: string; supervisorId: string };

function configurationLockKeys(studentLocationId: string, offerings: OfferingInput[]) {
  return [
    locationResourceLockKey(studentLocationId),
    ...offerings.map((item) => treatmentResourceLockKey(item.studentTreatmentId)),
    ...offerings.map((item) => supervisorResourceLockKey(item.supervisorId)),
  ];
}

async function validateConfiguration(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  studentLocationId: string,
  offerings: OfferingInput[],
  availabilityDurationMinutes: number,
) {
  const location = await transaction.studentLocation.findFirst({
    where: { id: studentLocationId, studentProfileId, deletedAt: null, city: { isActive: true } },
    select: { id: true },
  });
  const treatments = await transaction.studentTreatment.findMany({
    where: {
      id: { in: offerings.map((item) => item.studentTreatmentId) },
      studentProfileId,
      deletedAt: null,
      treatment: { isActive: true },
    },
    select: { id: true, durationMinutes: true, treatment: { select: { name: true } } },
  });
  const supervisors = await transaction.studentSupervisor.findMany({
    where: {
      id: { in: offerings.map((item) => item.supervisorId) },
      studentProfileId,
      deletedAt: null,
    },
    select: { id: true },
  });
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
  const treatmentThatDoesNotFit = treatments.find(
    (treatment) => treatment.durationMinutes > availabilityDurationMinutes,
  );
  if (treatmentThatDoesNotFit) {
    throw new AvailabilityDomainError(
      "INVALID_INTERVAL",
      `Tratamentul „${treatmentThatDoesNotFit.treatment.name}” durează ${treatmentThatDoesNotFit.durationMinutes} de minute și nu încape în intervalul de ${availabilityDurationMinutes} de minute.`,
    );
  }
}

function assertFuture(startsAt: Date, now: Date) {
  if (startsAt <= now) {
    throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Disponibilitatea trebuie să înceapă în viitor.");
  }
}

function wallClockDurationMinutes(startsAt: Date, endsAt: Date) {
  return minuteOfDayForBucharestInstant(endsAt) -
    minuteOfDayForBucharestInstant(startsAt);
}

function exactDurationMinutes(startsAt: Date, endsAt: Date) {
  const duration = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new AvailabilityDomainError("INVALID_INTERVAL", "Durata disponibilității nu este validă.");
  }
  return duration;
}

function translateMaterializationError(error: unknown): never {
  if (error instanceof MaterializationDomainError) {
    throw new AvailabilityDomainError(
      error.code === "LIMIT_EXCEEDED" ? "LIMIT_EXCEEDED" : "INVALID_INTERVAL",
      error.message,
    );
  }
  throw error;
}

function isTemporalConflict(error: unknown) {
  const text = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return text.includes("student_availability_slot_active_owner_time_excl");
}

async function resolveActiveAppointments(
  transaction: Prisma.TransactionClient,
  appointments: Array<{
    id: string;
    status: AppointmentStatus;
    version: number;
    patientProfile: { userId: string };
  }>,
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
    await transaction.appointmentNotification.create({
      data: {
        appointmentId: appointment.id,
        recipientUserId: appointment.patientProfile.userId,
        eventType: pending
          ? AppointmentStatus.REJECTED
          : AppointmentStatus.CANCELLED_BY_STUDENT,
        createdAt: now,
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

export async function listStudentAvailability(
  studentProfileId: string,
  from: Date,
  to: Date,
  now = new Date(),
) {
  const range = validateStudentCalendarRange(from, to, now);
  if (!range.ok) {
    throw new AvailabilityDomainError("INVALID_INTERVAL", range.error);
  }
  await ensureStudentSeriesMaterializedThrough(studentProfileId, to, now);
  return prisma.studentAvailabilitySlot.findMany({
    where: {
      studentProfileId,
      status: StudentAvailabilitySlotStatus.ACTIVE,
      startsAt: { lt: to },
      endsAt: { gt: from },
      OR: [
        { seriesId: null },
        { series: { status: StudentAvailabilitySeriesStatus.ACTIVE } },
      ],
    },
    orderBy: { startsAt: "asc" },
    include: slotInclude(now),
  });
}

export async function createAvailability(
  studentProfileId: string,
  input: Parsed<typeof parseCreateAvailabilityInput>,
) {
  const now = new Date();
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      const availabilityDurationMinutes = input.kind === "SINGLE"
        ? exactDurationMinutes(input.startsAt, input.endsAt)
        : input.rule.durationMinutes;
      await lockSchedulingKeys(transaction, [
        studentCalendarLockKey(studentProfileId),
        ...configurationLockKeys(input.studentLocationId, input.offerings),
      ]);
      await validateConfiguration(
        transaction,
        studentProfileId,
        input.studentLocationId,
        input.offerings,
        availabilityDurationMinutes,
      );
      if (input.kind === "SINGLE") {
        assertFuture(input.startsAt, now);
        const slot = await transaction.studentAvailabilitySlot.create({
          data: {
            studentProfileId,
            studentLocationId: input.studentLocationId,
            originalStartsAt: input.startsAt,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          },
          select: { id: true },
        });
        await transaction.studentAvailabilitySlotOffering.createMany({
          data: input.offerings.map((item) => ({
            slotId: slot.id,
            studentProfileId,
            ...item,
          })),
        });
        return transaction.studentAvailabilitySlot.findUniqueOrThrow({
          where: { id: slot.id },
          include: slotInclude(now),
        });
      }

      const activeSeriesCount = await transaction.studentAvailabilitySeries.count({
        where: { studentProfileId, status: StudentAvailabilitySeriesStatus.ACTIVE },
      });
      if (activeSeriesCount >= MAX_ACTIVE_SERIES_PER_STUDENT) {
        throw new AvailabilityDomainError(
          "LIMIT_EXCEEDED",
          `Poți avea cel mult ${MAX_ACTIVE_SERIES_PER_STUDENT} de serii active.`,
        );
      }

      const createdSeries = await transaction.studentAvailabilitySeries.create({
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
        },
        select: { id: true },
      });
      await transaction.studentAvailabilitySeriesOffering.createMany({
        data: input.offerings.map((item) => ({
          seriesId: createdSeries.id,
          studentProfileId,
          ...item,
        })),
      });
      const materialized = await materializeSeriesThrough(
        transaction,
        createdSeries.id,
        rollingMaterializationThrough(now),
        { now },
      );
      if (!materialized.occurrences.some((item) => item.startsAt > now)) {
        throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Seria trebuie să conțină cel puțin o apariție viitoare.");
      }
      return transaction.studentAvailabilitySeries.findUniqueOrThrow({
        where: { id: createdSeries.id },
        include: { offerings: true },
      });
    });
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError("CONFLICT", "Intervalul se suprapune peste o altă disponibilitate.");
    }
    translateMaterializationError(error);
  }
}

export async function updateAvailability(
  studentProfileId: string,
  actorUserId: string,
  slotId: string,
  input: Parsed<typeof parseUpdateAvailabilityInput>,
) {
  const now = new Date();
  assertFuture(input.startsAt, now);
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      const hint = await transaction.studentAvailabilitySlot.findFirst({
        where: { id: slotId, studentProfileId },
        select: { id: true, seriesId: true },
      });
      if (!hint) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Intervalul nu a fost găsit.");
      await lockSchedulingKeys(transaction, [
        studentCalendarLockKey(studentProfileId),
        availabilityRootLockKey(hint),
        ...configurationLockKeys(input.studentLocationId, input.offerings),
      ]);

      const slot = await transaction.studentAvailabilitySlot.findFirst({
        where: { id: slotId, studentProfileId },
        include: {
          series: true,
          appointments: {
            select: {
              id: true,
              status: true,
              version: true,
              pendingExpiresAt: true,
              patientProfile: { select: { userId: true } },
            },
          },
          offerings: { where: { removedAt: null } },
        },
      });
      if (!slot) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Intervalul nu a fost găsit.");
      if (slot.version !== input.expectedVersion) {
        throw new AvailabilityDomainError("STALE_VERSION", "Calendarul s-a modificat. Reîncarcă pagina.");
      }
      if (
        slot.status !== StudentAvailabilitySlotStatus.ACTIVE ||
        slot.startsAt <= now ||
        (slot.series && slot.series.status !== StudentAvailabilitySeriesStatus.ACTIVE)
      ) {
        throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Intervalul nu mai poate fi editat.");
      }
      const availabilityDurationMinutes = exactDurationMinutes(input.startsAt, input.endsAt);

      if (input.scope === "SERIES") {
        if (!slot.series || !input.rule) {
          throw new AvailabilityDomainError(
            "SERIES_NOT_FOUND",
            "Apariția selectată nu mai aparține unei serii active.",
          );
        }
        if (slot.series.revision !== input.expectedSeriesRevision) {
          throw new AvailabilityDomainError("STALE_VERSION", "Seria s-a modificat. Reîncarcă pagina.");
        }
        const localStart = bucharestPartsForInstant(input.startsAt);
        const submittedMinuteOfDay = localStart.hour * 60 + localStart.minute;
        if (
          input.rule.startsOn !== localDateForInstant(input.startsAt) ||
          input.rule.startMinuteOfDay !== submittedMinuteOfDay ||
          input.rule.durationMinutes !== wallClockDurationMinutes(input.startsAt, input.endsAt)
        ) {
          throw new AvailabilityDomainError(
            "INVALID_INTERVAL",
            "Regula seriei nu corespunde datei și intervalului selectat.",
          );
        }
        await validateConfiguration(
          transaction,
          studentProfileId,
          input.studentLocationId,
          input.offerings,
          input.rule.durationMinutes,
        );

        const affected = await transaction.studentAvailabilitySlot.findMany({
          where: {
            seriesId: slot.series.id,
            status: StudentAvailabilitySlotStatus.ACTIVE,
            ...(slot.sequenceNumber !== null
              ? { sequenceNumber: { gte: slot.sequenceNumber } }
              : { startsAt: { gte: slot.startsAt } }),
          },
          orderBy: { startsAt: "asc" },
          take: MAX_EXISTING_SLOTS_PER_SERIES_WINDOW + 1,
          include: {
            appointments: {
              select: {
                id: true,
                status: true,
                version: true,
                pendingExpiresAt: true,
                patientProfile: { select: { userId: true } },
              },
            },
          },
        });
        if (affected.length > MAX_EXISTING_SLOTS_PER_SERIES_WINDOW) {
          throw new AvailabilityDomainError(
            "LIMIT_EXCEEDED",
            "Seria conține prea multe apariții pentru o singură operație.",
          );
        }
        const activeAppointments = affected.flatMap((item) =>
          item.appointments.filter((appointment) =>
            appointment.status === AppointmentStatus.CONFIRMED ||
            (appointment.status === AppointmentStatus.PENDING &&
              appointment.pendingExpiresAt !== null &&
              appointment.pendingExpiresAt > now),
          ),
        );
        await resolveActiveAppointments(
          transaction,
          activeAppointments,
          input.appointmentReason,
          actorUserId,
          now,
        );

        const retainedIds = affected
          .filter((item) => item.appointments.length > 0)
          .map((item) => item.id);
        const removableIds = affected
          .filter((item) => item.appointments.length === 0)
          .map((item) => item.id);
        if (retainedIds.length > 0) {
          await transaction.studentAvailabilitySlot.updateMany({
            where: { id: { in: retainedIds } },
            data: {
              status: StudentAvailabilitySlotStatus.CANCELLED,
              cancelledAt: now,
              isException: true,
              version: { increment: 1 },
            },
          });
        }
        if (removableIds.length > 0) {
          await transaction.studentAvailabilitySlot.deleteMany({
            where: { id: { in: removableIds } },
          });
        }
        await transaction.studentAvailabilitySeries.update({
          where: { id: slot.series.id, revision: slot.series.revision },
          data: {
            status: StudentAvailabilitySeriesStatus.CANCELLED,
            revision: { increment: 1 },
          },
        });

        const createdSeries = await transaction.studentAvailabilitySeries.create({
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
          },
          select: { id: true },
        });
        await transaction.studentAvailabilitySeriesOffering.createMany({
          data: input.offerings.map((item) => ({
            seriesId: createdSeries.id,
            studentProfileId,
            ...item,
          })),
        });
        const materialized = await materializeSeriesThrough(
          transaction,
          createdSeries.id,
          rollingMaterializationThrough(now),
          { now },
        );
        if (!materialized.occurrences.some((item) => item.startsAt > now)) {
          throw new AvailabilityDomainError(
            "SLOT_ALREADY_STARTED",
            "Seria trebuie să conțină cel puțin o apariție viitoare.",
          );
        }
        return transaction.studentAvailabilitySeries.findUniqueOrThrow({
          where: { id: createdSeries.id },
          include: { offerings: true },
        });
      }

      await validateConfiguration(transaction, studentProfileId, input.studentLocationId, input.offerings, availabilityDurationMinutes);
      const activeAppointments = slot.appointments.filter(
        (appointment) =>
          appointment.status === AppointmentStatus.CONFIRMED ||
          (appointment.status === AppointmentStatus.PENDING &&
            appointment.pendingExpiresAt !== null &&
            appointment.pendingExpiresAt > now),
      );
      await resolveActiveAppointments(
        transaction,
        activeAppointments,
        input.appointmentReason,
        actorUserId,
        now,
      );

      if (slot.appointments.length === 0) {
        await transaction.studentAvailabilitySlotOffering.deleteMany({ where: { slotId: slot.id } });
      } else {
        await transaction.studentAvailabilitySlotOffering.updateMany({
          where: { slotId: slot.id, removedAt: null },
          data: { removedAt: now },
        });
      }
      await transaction.studentAvailabilitySlot.update({
        where: { id: slot.id, version: slot.version },
        data: {
          studentLocationId: input.studentLocationId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isException: slot.seriesId !== null || slot.isException,
          version: { increment: 1 },
        },
      });
      await transaction.studentAvailabilitySlotOffering.createMany({
        data: input.offerings.map((item) => ({
          slotId: slot.id,
          studentProfileId,
          ...item,
        })),
      });
      return transaction.studentAvailabilitySlot.findUniqueOrThrow({
        where: { id: slot.id },
        include: slotInclude(now),
      });
    });
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError("CONFLICT", "Intervalul editat se suprapune peste altă disponibilitate.");
    }
    translateMaterializationError(error);
  }
}

export async function cancelAvailability(
  studentProfileId: string,
  actorUserId: string,
  slotId: string,
  input: Parsed<typeof parseCancelAvailabilityInput>,
) {
  return runSerializableTransaction(prisma, async (transaction) => {
    const hint = await transaction.studentAvailabilitySlot.findFirst({
      where: { id: slotId, studentProfileId },
      select: { id: true, seriesId: true },
    });
    if (!hint) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Intervalul nu a fost găsit.");
    await lockSchedulingKeys(transaction, [availabilityRootLockKey(hint)]);

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
    if (slot.series && slot.series.status !== StudentAvailabilitySeriesStatus.ACTIVE) {
      throw new AvailabilityDomainError("SERIES_NOT_FOUND", "Seria nu mai este activă.");
    }
    if (input.scope === "SERIES" && slot.series) {
      if (slot.series.revision !== input.expectedSeriesRevision) {
        throw new AvailabilityDomainError("STALE_VERSION", "Seria s-a modificat. Reîncarcă pagina.");
      }
    }
    const where = input.scope === "SERIES" && slot.seriesId
      ? { seriesId: slot.seriesId, status: StudentAvailabilitySlotStatus.ACTIVE, startsAt: { gt: now } }
      : { id: slot.id, status: StudentAvailabilitySlotStatus.ACTIVE };
    const affected = await transaction.studentAvailabilitySlot.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: MAX_EXISTING_SLOTS_PER_SERIES_WINDOW + 1,
      include: {
        appointments: {
          select: {
            id: true,
            status: true,
            version: true,
            pendingExpiresAt: true,
            patientProfile: { select: { userId: true } },
          },
        },
      },
    });
    if (affected.length > MAX_EXISTING_SLOTS_PER_SERIES_WINDOW) {
      throw new AvailabilityDomainError(
        "LIMIT_EXCEEDED",
        "Seria conține prea multe apariții pentru o singură operație.",
      );
    }
    const appointments = affected.flatMap((item) =>
      item.appointments.filter((appointment) =>
        appointment.status === AppointmentStatus.CONFIRMED ||
        (appointment.status === AppointmentStatus.PENDING &&
          appointment.pendingExpiresAt !== null &&
          appointment.pendingExpiresAt > now),
      ),
    );
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
      await transaction.studentAvailabilitySeries.update({
        where: { id: slot.series.id, revision: slot.series.revision },
        data: { status: StudentAvailabilitySeriesStatus.CANCELLED, revision: { increment: 1 } },
      });
    }
    return { cancelledSlots: affected.length };
  });
}
