import type { Prisma } from "@/generated/prisma/client";
import {
  AppointmentStatus,
  StudentAvailabilitySlotStatus,
} from "@/generated/prisma/enums";
import {
  localDateForInstant,
  prismaDateToLocalDate,
  localDateToPrismaDate,
} from "@/lib/availability/bucharest-time";
import {
  defaultMaterializationDate,
  generateOccurrences,
} from "@/lib/availability/recurrence";

const activeAppointmentStatuses = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

type MaterializableSeries = {
  id: string;
  studentProfileId: string;
  studentLocationId: string;
  startsOn: Date;
  startMinuteOfDay: number;
  weekdays: Parameters<typeof generateOccurrences>[0]["weekdays"];
  intervalWeeks: number;
  durationMinutes: number;
  endMode: "NEVER" | "UNTIL" | "COUNT";
  endsOn: Date | null;
  occurrenceCount: number | null;
  revision: number;
  offerings: Array<{
    studentTreatmentId: string;
    supervisorId: string;
  }>;
};

function materializationTarget(series: MaterializableSeries, requested?: string) {
  let target = requested ?? defaultMaterializationDate();
  if (series.endMode === "UNTIL" && series.endsOn) {
    const endsOn = prismaDateToLocalDate(series.endsOn);
    if (endsOn < target) target = endsOn;
  }
  return target;
}

export async function materializeSeriesThrough(
  transaction: Prisma.TransactionClient,
  series: MaterializableSeries,
  requestedThrough?: string,
) {
  const target = materializationTarget(series, requestedThrough);
  const occurrences = generateOccurrences(
    {
      startsOn: prismaDateToLocalDate(series.startsOn),
      startMinuteOfDay: series.startMinuteOfDay,
      weekdays: series.weekdays,
      intervalWeeks: series.intervalWeeks === 2 ? 2 : 1,
      durationMinutes: series.durationMinutes,
      endMode: series.endMode,
      endsOn: series.endsOn ? prismaDateToLocalDate(series.endsOn) : null,
      occurrenceCount: series.occurrenceCount,
    },
    target,
  );

  const existing = await transaction.studentAvailabilitySlot.findMany({
    where: { seriesId: series.id },
    select: {
      id: true,
      originalStartsAt: true,
      isException: true,
      startsAt: true,
      endsAt: true,
      status: true,
      appointments: {
        where: { status: { in: activeAppointmentStatuses } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const byOriginalStart = new Map(
    existing.map((slot) => [slot.originalStartsAt.toISOString(), slot]),
  );
  let created = 0;
  let updated = 0;
  let preserved = 0;

  for (const occurrence of occurrences) {
    const key = occurrence.startsAt.toISOString();
    const slot = byOriginalStart.get(key);

    if (!slot) {
      const createdSlot = await transaction.studentAvailabilitySlot.create({
        data: {
          studentProfileId: series.studentProfileId,
          studentLocationId: series.studentLocationId,
          seriesId: series.id,
          sequenceNumber: occurrence.sequenceNumber,
          originalStartsAt: occurrence.startsAt,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          sourceRevision: series.revision,
        },
        select: { id: true },
      });
      await transaction.studentAvailabilitySlotOffering.createMany({
        data: series.offerings.map((offering) => ({
          slotId: createdSlot.id,
          studentProfileId: series.studentProfileId,
          studentTreatmentId: offering.studentTreatmentId,
          supervisorId: offering.supervisorId,
        })),
      });
      created += 1;
      continue;
    }

    if (slot.isException || slot.appointments.length > 0) {
      preserved += 1;
      continue;
    }

    await transaction.studentAvailabilitySlot.update({
      where: { id: slot.id },
      data: {
        sequenceNumber: occurrence.sequenceNumber,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        status: StudentAvailabilitySlotStatus.ACTIVE,
        cancelledAt: null,
        sourceRevision: series.revision,
        version: { increment: 1 },
      },
    });
    updated += 1;
  }

  await transaction.studentAvailabilitySeries.update({
    where: { id: series.id },
    data: { materializedThrough: localDateToPrismaDate(target) },
  });

  return { created, updated, preserved, through: target, occurrences };
}

export async function ensureStudentSeriesMaterializedThrough(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  throughInstant: Date,
) {
  const through = localDateForInstant(throughInstant);
  const series = await transaction.studentAvailabilitySeries.findMany({
    where: {
      studentProfileId,
      status: "ACTIVE",
      OR: [
        { materializedThrough: null },
        { materializedThrough: { lt: localDateToPrismaDate(through) ?? undefined } },
      ],
    },
    include: { offerings: true },
  });

  for (const item of series) {
    await materializeSeriesThrough(transaction, item, through);
  }
}
