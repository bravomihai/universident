import type { Prisma } from "@/generated/prisma/client";
import {
  AppointmentStatus,
  StudentAvailabilityEndMode,
  StudentAvailabilitySeriesStatus,
  StudentAvailabilitySlotStatus,
  StudentAvailabilityWeekday,
} from "@/generated/prisma/enums";
import type {
  parseCancelAvailabilityInput,
  parseCreateAvailabilityInput,
  parseMoveAvailabilityInput,
} from "@/lib/availability/availability-input";
import {
  addLocalDays,
  bucharestPartsForInstant,
  localDateForInstant,
  localDateToPrismaDate,
  prismaDateToLocalDate,
} from "@/lib/availability/bucharest-time";
import { materializeSeriesThrough } from "@/lib/availability/materializer";
import { defaultMaterializationDate } from "@/lib/availability/recurrence";
import { prisma } from "@/lib/prisma";

type SuccessData<T> = T extends { ok: true; data: infer Data } ? Data : never;
type Parsed<T extends (value: unknown) => unknown> = SuccessData<ReturnType<T>>;

export type AvailabilityDomainErrorCode =
  | "ASSOCIATION_NOT_FOUND"
  | "SLOT_NOT_FOUND"
  | "SERIES_NOT_FOUND"
  | "SLOT_ALREADY_STARTED"
  | "SLOT_OCCUPIED_REASON_REQUIRED"
  | "STALE_VERSION"
  | "INVALID_INTERVAL"
  | "CONFLICT";

export class AvailabilityDomainError extends Error {
  constructor(
    readonly code: AvailabilityDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const activeAppointmentStatuses = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

const slotInclude = {
  treatmentLocation: {
    include: {
      studentTreatment: { include: { treatment: true } },
      studentLocation: { include: { city: true } },
      supervisor: true,
    },
  },
  series: true,
  appointments: {
    where: { status: { in: activeAppointmentStatuses } },
    include: {
      patientProfile: {
        select: { id: true, user: { select: { id: true, name: true } } },
      },
    },
    take: 1,
  },
} satisfies Prisma.StudentAvailabilitySlotInclude;

async function activeAssociation(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  id: string,
) {
  const association = await transaction.studentTreatmentLocation.findFirst({
    where: {
      id,
      studentProfileId,
      isActive: true,
      deletedAt: null,
      studentTreatment: { isActive: true, deletedAt: null },
      studentLocation: { isActive: true, deletedAt: null },
      supervisor: { isActive: true, deletedAt: null },
    },
    include: { studentTreatment: true },
  });
  if (!association) {
    throw new AvailabilityDomainError(
      "ASSOCIATION_NOT_FOUND",
      "Tratamentul, locația și supervizorul selectate nu mai sunt disponibile.",
    );
  }
  return association;
}

async function resolveActiveAppointment(
  transaction: Prisma.TransactionClient,
  slot: {
    appointments: Array<{ id: string; status: AppointmentStatus; version: number }>;
  },
  reason: string | null,
  actorUserId: string,
  now: Date,
) {
  const appointment = slot.appointments[0];
  if (!appointment) return;
  if (!reason) {
    throw new AvailabilityDomainError(
      "SLOT_OCCUPIED_REASON_REQUIRED",
      "Slotul are o cerere sau o programare. Scrie motivul anulării înainte de a continua.",
    );
  }
  const pending = appointment.status === AppointmentStatus.PENDING;
  await transaction.appointment.update({
    where: { id: appointment.id, version: appointment.version },
    data: {
      status: pending
        ? AppointmentStatus.REJECTED
        : AppointmentStatus.CANCELLED_BY_STUDENT,
      statusReason: reason,
      statusReasonCode: pending ? "SLOT_CHANGED" : "STUDENT_SLOT_CHANGED",
      statusChangedAt: now,
      statusChangedByUserId: actorUserId,
      rejectedAt: pending ? now : undefined,
      cancelledAt: pending ? undefined : now,
      version: { increment: 1 },
    },
  });
}

function assertFuture(startsAt: Date, now = new Date()) {
  if (startsAt.getTime() <= now.getTime()) {
    throw new AvailabilityDomainError(
      "SLOT_ALREADY_STARTED",
      "Disponibilitatea trebuie să înceapă în viitor.",
    );
  }
}

function isTemporalConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const text = "message" in error ? String(error.message) : "";
  return text.includes("student_availability_slot_active_owner_time_excl");
}

export async function getStudentAvailabilityCatalog(studentProfileId: string) {
  return prisma.studentTreatmentLocation.findMany({
    where: {
      studentProfileId,
      isActive: true,
      deletedAt: null,
      studentTreatment: { isActive: true, deletedAt: null },
      studentLocation: { isActive: true, deletedAt: null },
      supervisor: { isActive: true, deletedAt: null },
    },
    orderBy: [
      { studentTreatment: { treatment: { name: "asc" } } },
      { studentLocation: { name: "asc" } },
    ],
    select: {
      id: true,
      studentTreatment: {
        select: { durationMinutes: true, treatment: { select: { name: true } } },
      },
      studentLocation: { select: { name: true, address: true } },
      supervisor: { select: { fullName: true, academicTitle: true } },
    },
  });
}

export async function listStudentAvailability(
  studentProfileId: string,
  from: Date,
  to: Date,
) {
  if (to <= from || to.getTime() - from.getTime() > 370 * 86_400_000) {
    throw new AvailabilityDomainError(
      "INVALID_INTERVAL",
      "Intervalul calendarului nu este valid.",
    );
  }
  await prisma.$transaction(async (transaction) => {
    const series = await transaction.studentAvailabilitySeries.findMany({
      where: { studentProfileId, status: StudentAvailabilitySeriesStatus.ACTIVE },
    });
    for (const item of series) {
      await materializeSeriesThrough(transaction, item, localDateForInstant(to));
    }
  });
  return prisma.studentAvailabilitySlot.findMany({
    where: {
      studentProfileId,
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
    return await prisma.$transaction(
      async (transaction) => {
        const association = await activeAssociation(
          transaction,
          studentProfileId,
          input.studentTreatmentLocationId,
        );
        const durationMinutes = association.studentTreatment.durationMinutes;

        if (input.kind === "SINGLE") {
          assertFuture(input.startsAt);
          return transaction.studentAvailabilitySlot.create({
            data: {
              studentProfileId,
              studentTreatmentLocationId: association.id,
              originalStartsAt: input.startsAt,
              startsAt: input.startsAt,
              endsAt: new Date(input.startsAt.getTime() + durationMinutes * 60_000),
            },
            include: slotInclude,
          });
        }

        const firstInstant = new Date(`${input.rule.startsOn}T00:00:00Z`);
        if (Number.isNaN(firstInstant.getTime())) {
          throw new AvailabilityDomainError("INVALID_INTERVAL", "Data de început nu este validă.");
        }
        const series = await transaction.studentAvailabilitySeries.create({
          data: {
            studentProfileId,
            studentTreatmentLocationId: association.id,
            startsOn: localDateToPrismaDate(input.rule.startsOn)!,
            startMinuteOfDay: input.rule.startMinuteOfDay,
            weekdays: input.rule.weekdays,
            intervalWeeks: input.rule.intervalWeeks,
            durationMinutes,
            endMode: input.rule.endMode,
            endsOn: input.rule.endsOn
              ? localDateToPrismaDate(input.rule.endsOn)
              : null,
            occurrenceCount: input.rule.occurrenceCount,
          },
        });
        const materialized = await materializeSeriesThrough(
          transaction,
          series,
          defaultMaterializationDate(),
        );
        if (!materialized.occurrences.some((item) => item.startsAt > new Date())) {
          throw new AvailabilityDomainError(
            "SLOT_ALREADY_STARTED",
            "Seria trebuie să conțină cel puțin o apariție viitoare.",
          );
        }
        return transaction.studentAvailabilitySeries.findUniqueOrThrow({
          where: { id: series.id },
          include: { slots: { orderBy: { startsAt: "asc" }, include: slotInclude } },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError(
        "CONFLICT",
        "Intervalul se suprapune peste o altă disponibilitate.",
      );
    }
    throw error;
  }
}

function weekdayShift(
  weekdays: StudentAvailabilityWeekday[],
  oldInstant: Date,
  newInstant: Date,
) {
  const order = [
    StudentAvailabilityWeekday.SUNDAY,
    StudentAvailabilityWeekday.MONDAY,
    StudentAvailabilityWeekday.TUESDAY,
    StudentAvailabilityWeekday.WEDNESDAY,
    StudentAvailabilityWeekday.THURSDAY,
    StudentAvailabilityWeekday.FRIDAY,
    StudentAvailabilityWeekday.SATURDAY,
  ];
  const oldParts = bucharestPartsForInstant(oldInstant);
  const newParts = bucharestPartsForInstant(newInstant);
  const oldDay = new Date(Date.UTC(oldParts.year, oldParts.month - 1, oldParts.day)).getUTCDay();
  const newDay = new Date(Date.UTC(newParts.year, newParts.month - 1, newParts.day)).getUTCDay();
  const delta = (newDay - oldDay + 7) % 7;
  return weekdays.map((weekday) => order[(order.indexOf(weekday) + delta) % 7]);
}

function localDayDifference(first: Date, second: Date) {
  const a = bucharestPartsForInstant(first);
  const b = bucharestPartsForInstant(second);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) /
      86_400_000,
  );
}

export async function moveAvailability(
  studentProfileId: string,
  actorUserId: string,
  slotId: string,
  input: Parsed<typeof parseMoveAvailabilityInput>,
) {
  assertFuture(input.startsAt);
  try {
    return await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
        const slot = await transaction.studentAvailabilitySlot.findFirst({
          where: { id: slotId, studentProfileId },
          include: { series: true, appointments: { where: { status: { in: activeAppointmentStatuses } } } },
        });
        if (!slot) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Slotul nu a fost găsit.");
        if (slot.version !== input.expectedVersion) {
          throw new AvailabilityDomainError("STALE_VERSION", "Calendarul s-a modificat. Reîncarcă pagina.");
        }
        if (slot.status !== StudentAvailabilitySlotStatus.ACTIVE || slot.startsAt <= new Date()) {
          throw new AvailabilityDomainError("SLOT_ALREADY_STARTED", "Slotul nu mai poate fi mutat.");
        }
        const now = new Date();

        if (input.scope === "OCCURRENCE" || !slot.series) {
          await resolveActiveAppointment(transaction, slot, input.appointmentReason, actorUserId, now);
          const duration = slot.endsAt.getTime() - slot.startsAt.getTime();
          return transaction.studentAvailabilitySlot.update({
            where: { id: slot.id, version: slot.version },
            data: {
              startsAt: input.startsAt,
              endsAt: new Date(input.startsAt.getTime() + duration),
              isException: slot.seriesId !== null || slot.isException,
              version: { increment: 1 },
            },
            include: slotInclude,
          });
        }

        const series = slot.series;
        if (series.revision !== input.expectedSeriesRevision) {
          throw new AvailabilityDomainError("STALE_VERSION", "Seria s-a modificat. Reîncarcă pagina.");
        }
        const affectedWhere = input.scope === "SERIES"
          ? { seriesId: series.id, status: StudentAvailabilitySlotStatus.ACTIVE }
          : { seriesId: series.id, status: StudentAvailabilitySlotStatus.ACTIVE, originalStartsAt: { gte: slot.originalStartsAt } };
        const affected = await transaction.studentAvailabilitySlot.findMany({
          where: affectedWhere,
          include: { appointments: { where: { status: { in: activeAppointmentStatuses } } } },
        });
        if (affected.some((item) => item.appointments.length > 0) && !input.appointmentReason) {
          throw new AvailabilityDomainError(
            "SLOT_OCCUPIED_REASON_REQUIRED",
            "Seria conține cereri sau programări. Scrie motivul anulării înainte de a continua.",
          );
        }
        for (const item of affected) {
          await resolveActiveAppointment(transaction, item, input.appointmentReason, actorUserId, now);
        }
        await transaction.studentAvailabilitySlot.updateMany({
          where: affectedWhere,
          data: { status: StudentAvailabilitySlotStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
        });

        const newParts = bucharestPartsForInstant(input.startsAt);
        const newStartDate = localDateForInstant(input.startsAt);
        const startMinuteOfDay = newParts.hour * 60 + newParts.minute;
        const shiftedWeekdays = weekdayShift(series.weekdays, slot.startsAt, input.startsAt);
        const dayDelta = localDayDifference(slot.startsAt, input.startsAt);

        if (input.scope === "SERIES") {
          const updated = await transaction.studentAvailabilitySeries.update({
            where: { id: series.id, revision: series.revision },
            data: {
              startsOn: localDateToPrismaDate(addLocalDays(prismaDateToLocalDate(series.startsOn), dayDelta))!,
              startMinuteOfDay,
              weekdays: shiftedWeekdays,
              endsOn: series.endsOn
                ? localDateToPrismaDate(addLocalDays(prismaDateToLocalDate(series.endsOn), dayDelta))
                : null,
              revision: { increment: 1 },
              materializedThrough: null,
            },
          });
          await materializeSeriesThrough(transaction, updated, defaultMaterializationDate());
          return updated;
        }

        const previousDay = addLocalDays(localDateForInstant(slot.originalStartsAt), -1);
        await transaction.studentAvailabilitySeries.update({
          where: { id: series.id, revision: series.revision },
          data: {
            endMode: StudentAvailabilityEndMode.UNTIL,
            endsOn: localDateToPrismaDate(previousDay),
            occurrenceCount: null,
            revision: { increment: 1 },
          },
        });
        const remainingCount = series.endMode === StudentAvailabilityEndMode.COUNT && series.occurrenceCount
          ? Math.max(1, series.occurrenceCount - ((slot.sequenceNumber ?? 1) - 1))
          : null;
        const nextSeries = await transaction.studentAvailabilitySeries.create({
          data: {
            studentProfileId,
            studentTreatmentLocationId: series.studentTreatmentLocationId,
            startsOn: localDateToPrismaDate(newStartDate)!,
            startMinuteOfDay,
            weekdays: shiftedWeekdays,
            intervalWeeks: series.intervalWeeks,
            durationMinutes: series.durationMinutes,
            endMode: series.endMode,
            endsOn: series.endsOn
              ? localDateToPrismaDate(addLocalDays(prismaDateToLocalDate(series.endsOn), dayDelta))
              : null,
            occurrenceCount: remainingCount,
          },
        });
        await materializeSeriesThrough(transaction, nextSeries, defaultMaterializationDate());
        return nextSeries;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (isTemporalConflict(error)) {
      throw new AvailabilityDomainError("CONFLICT", "Mutarea se suprapune peste altă disponibilitate.");
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
  return prisma.$transaction(
    async (transaction) => {
      const slot = await transaction.studentAvailabilitySlot.findFirst({
        where: { id: slotId, studentProfileId },
        include: { series: true, appointments: { where: { status: { in: activeAppointmentStatuses } } } },
      });
      if (!slot) throw new AvailabilityDomainError("SLOT_NOT_FOUND", "Slotul nu a fost găsit.");
      if (slot.version !== input.expectedVersion) {
        throw new AvailabilityDomainError("STALE_VERSION", "Calendarul s-a modificat. Reîncarcă pagina.");
      }
      const now = new Date();
      const where = input.scope === "SERIES" && slot.seriesId
        ? { seriesId: slot.seriesId, status: StudentAvailabilitySlotStatus.ACTIVE, startsAt: { gt: now } }
        : { id: slot.id, status: StudentAvailabilitySlotStatus.ACTIVE };
      const affected = await transaction.studentAvailabilitySlot.findMany({
        where,
        include: { appointments: { where: { status: { in: activeAppointmentStatuses } } } },
      });
      if (affected.some((item) => item.appointments.length > 0) && !input.appointmentReason) {
        throw new AvailabilityDomainError(
          "SLOT_OCCUPIED_REASON_REQUIRED",
          "Există cereri sau programări active. Motivul anulării este obligatoriu.",
        );
      }
      for (const item of affected) {
        await resolveActiveAppointment(transaction, item, input.appointmentReason, actorUserId, now);
      }
      await transaction.studentAvailabilitySlot.updateMany({
        where,
        data: { status: StudentAvailabilitySlotStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
      });
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
    },
    { isolationLevel: "Serializable" },
  );
}
