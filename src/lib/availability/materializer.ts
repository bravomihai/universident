import type { Prisma } from "@/generated/prisma/client";
import {
  StudentAvailabilitySeriesStatus,
  StudentAvailabilitySlotStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  addLocalDays,
  compareLocalDates,
  localDateForInstant,
  localDateToPrismaDate,
  prismaDateToLocalDate,
} from "@/lib/availability/bucharest-time";
import {
  boundedMaterializationThrough,
  MATERIALIZATION_BATCH_SIZE,
  MAX_EXISTING_SLOTS_PER_SERIES_WINDOW,
  MAX_SERIES_PER_MATERIALIZATION_OPERATION,
  rollingMaterializationThrough,
} from "@/lib/availability/limits";
import {
  generateOccurrences,
  OccurrenceGenerationLimitError,
} from "@/lib/availability/recurrence";
import { prisma } from "@/lib/prisma";
import { runSeriesOperationsIsolated } from "@/lib/availability/series-isolation";
import {
  lockSchedulingKeys,
  seriesLockKey,
} from "@/lib/scheduling/locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

export class MaterializationDomainError extends Error {
  constructor(
    readonly code: "LIMIT_EXCEEDED" | "STALE_REVISION" | "INVALID_RULE",
    message: string,
  ) {
    super(message);
    this.name = "MaterializationDomainError";
  }
}

type MaterializationOptions = {
  now?: Date;
  expectedRevision?: number;
  afterLock?: () => Promise<void>;
};

function materializationTarget(
  series: { endMode: string; endsOn: Date | null },
  requestedThrough: string,
  now: Date,
) {
  const bounded = boundedMaterializationThrough(requestedThrough, now);
  if (!bounded) {
    throw new MaterializationDomainError(
      "INVALID_RULE",
      "Data până la care se materializează seria nu este validă.",
    );
  }
  let target = bounded;
  if (series.endMode === "UNTIL" && series.endsOn) {
    const endsOn = prismaDateToLocalDate(series.endsOn);
    if (compareLocalDates(endsOn, target) < 0) target = endsOn;
  }
  return target;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function materializeSeriesThrough(
  transaction: Prisma.TransactionClient,
  seriesId: string,
  requestedThrough?: string,
  options: MaterializationOptions = {},
) {
  const now = options.now ?? new Date();
  const requested = requestedThrough ?? rollingMaterializationThrough(now);

  // Lock order is shared with edit/cancel/archive operations. Nothing fetched
  // before this point is used as authoritative series state.
  await lockSchedulingKeys(transaction, [seriesLockKey(seriesId)]);
  await options.afterLock?.();

  const series = await transaction.studentAvailabilitySeries.findUnique({
    where: { id: seriesId },
    include: {
      studentLocation: { select: { deletedAt: true } },
      offerings: {
        include: {
          studentTreatment: { select: { deletedAt: true, durationMinutes: true } },
          supervisor: { select: { deletedAt: true } },
        },
      },
    },
  });

  if (!series) {
    return { skipped: "SERIES_NOT_FOUND" as const, created: 0, updated: 0, preserved: 0, occurrences: [] };
  }
  if (series.status !== StudentAvailabilitySeriesStatus.ACTIVE) {
    return { skipped: "SERIES_INACTIVE" as const, created: 0, updated: 0, preserved: 0, occurrences: [] };
  }
  if (options.expectedRevision !== undefined && series.revision !== options.expectedRevision) {
    throw new MaterializationDomainError(
      "STALE_REVISION",
      "Seria s-a modificat înainte de materializare.",
    );
  }
  if (
    series.studentLocation.deletedAt ||
    series.offerings.length === 0 ||
    series.offerings.some(
      (offering) => offering.studentTreatment.deletedAt || offering.supervisor.deletedAt,
    )
  ) {
    return { skipped: "RESOURCE_INACTIVE" as const, created: 0, updated: 0, preserved: 0, occurrences: [] };
  }

  const target = materializationTarget(series, requested, now);
  const startsOn = prismaDateToLocalDate(series.startsOn);
  const previousThrough = series.materializedThrough
    ? prismaDateToLocalDate(series.materializedThrough)
    : null;
  if (previousThrough && compareLocalDates(previousThrough, target) >= 0) {
    return {
      skipped: "ALREADY_MATERIALIZED" as const,
      created: 0,
      updated: 0,
      preserved: 0,
      through: previousThrough,
      occurrences: [],
    };
  }

  const fromLocalDate = previousThrough ? addLocalDays(previousThrough, 1) : startsOn;
  if (compareLocalDates(fromLocalDate, target) > 0) {
    return {
      skipped: "ALREADY_MATERIALIZED" as const,
      created: 0,
      updated: 0,
      preserved: 0,
      through: previousThrough ?? startsOn,
      occurrences: [],
    };
  }

  const sequence = await transaction.studentAvailabilitySlot.aggregate({
    where: { seriesId },
    _max: { sequenceNumber: true },
  });

  let occurrences;
  try {
    occurrences = generateOccurrences(
      {
        startsOn,
        startMinuteOfDay: series.startMinuteOfDay,
        weekdays: series.weekdays,
        intervalWeeks: series.intervalWeeks === 2 ? 2 : 1,
        durationMinutes: series.durationMinutes,
        endMode: series.endMode,
        endsOn: series.endsOn ? prismaDateToLocalDate(series.endsOn) : null,
        occurrenceCount: series.occurrenceCount,
      },
      target,
      {
        fromLocalDate,
        initialSequenceNumber: sequence._max.sequenceNumber ?? 0,
        minimumElapsedDurationMinutes: Math.max(
          ...series.offerings.map((offering) => offering.studentTreatment.durationMinutes),
        ),
      },
    );
  } catch (error) {
    if (error instanceof OccurrenceGenerationLimitError) {
      throw new MaterializationDomainError("LIMIT_EXCEEDED", error.message);
    }
    throw error;
  }

  const existing = occurrences.length === 0
    ? []
    : await transaction.studentAvailabilitySlot.findMany({
        where: {
          seriesId,
          originalStartsAt: { in: occurrences.map((occurrence) => occurrence.startsAt) },
        },
        take: MAX_EXISTING_SLOTS_PER_SERIES_WINDOW + 1,
        select: {
          id: true,
          originalStartsAt: true,
          isException: true,
          appointments: { select: { id: true }, take: 1 },
        },
      });

  if (existing.length > MAX_EXISTING_SLOTS_PER_SERIES_WINDOW) {
    throw new MaterializationDomainError(
      "LIMIT_EXCEEDED",
      "Seria conține prea multe excepții într-o singură fereastră.",
    );
  }

  const byOriginalStart = new Map(
    existing.map((slot) => [slot.originalStartsAt.toISOString(), slot]),
  );
  let created = 0;
  let updated = 0;
  let preserved = 0;

  for (const batch of chunks(occurrences, MATERIALIZATION_BATCH_SIZE)) {
    const missing = batch.filter(
      (occurrence) => !byOriginalStart.has(occurrence.startsAt.toISOString()),
    );
    if (missing.length > 0) {
      const createdSlots = await transaction.studentAvailabilitySlot.createManyAndReturn({
        data: missing.map((occurrence) => ({
          studentProfileId: series.studentProfileId,
          studentLocationId: series.studentLocationId,
          seriesId: series.id,
          sequenceNumber: occurrence.sequenceNumber,
          originalStartsAt: occurrence.startsAt,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          sourceRevision: series.revision,
        })),
        select: { id: true, originalStartsAt: true },
      });
      if (createdSlots.length > 0) {
        await transaction.studentAvailabilitySlotOffering.createMany({
          data: createdSlots.flatMap((slot) =>
            series.offerings.map((offering) => ({
              slotId: slot.id,
              studentProfileId: series.studentProfileId,
              studentTreatmentId: offering.studentTreatmentId,
              supervisorId: offering.supervisorId,
            })),
          ),
        });
      }
      created += createdSlots.length;
    }

    for (const occurrence of batch) {
      const slot = byOriginalStart.get(occurrence.startsAt.toISOString());
      if (!slot) continue;
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
  }

  await transaction.studentAvailabilitySeries.update({
    where: {
      id: series.id,
      revision: series.revision,
      status: StudentAvailabilitySeriesStatus.ACTIVE,
    },
    data: { materializedThrough: localDateToPrismaDate(target) },
  });

  return { created, updated, preserved, through: target, occurrences };
}

function diagnosticCode(error: unknown) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") return error.code;
    if ("name" in error && typeof error.name === "string") return error.name;
  }
  return "UNKNOWN";
}

async function materializeSeriesIdsSafely(
  seriesIds: string[],
  throughInstant: Date,
  now: Date,
) {
  await runSeriesOperationsIsolated(
    seriesIds,
    async (seriesId) => {
      await runSerializableTransaction(
        prisma,
        (transaction) =>
          materializeSeriesThrough(
            transaction,
            seriesId,
            localDateForInstant(throughInstant),
            { now },
          ),
      );
    },
    (seriesId, error) => {
      console.error("Availability series materialization failed", {
        seriesId,
        code: diagnosticCode(error),
      });
    },
  );
}

export async function ensureStudentSeriesMaterializedThrough(
  studentProfileId: string,
  throughInstant: Date,
  now = new Date(),
) {
  const through = boundedMaterializationThrough(localDateForInstant(throughInstant), now);
  if (!through) return;
  const series = await prisma.studentAvailabilitySeries.findMany({
    where: {
      studentProfileId,
      status: StudentAvailabilitySeriesStatus.ACTIVE,
      OR: [
        { materializedThrough: null },
        { materializedThrough: { lt: localDateToPrismaDate(through) ?? undefined } },
      ],
    },
    orderBy: { id: "asc" },
    take: MAX_SERIES_PER_MATERIALIZATION_OPERATION + 1,
    select: { id: true },
  });
  if (series.length > MAX_SERIES_PER_MATERIALIZATION_OPERATION) {
    console.warn("Student series materialization limit reached", { studentProfileId });
  }
  await materializeSeriesIdsSafely(
    series.slice(0, MAX_SERIES_PER_MATERIALIZATION_OPERATION).map((item) => item.id),
    throughInstant,
    now,
  );
}

type PublicSeriesFilters = {
  treatmentSlug: string;
  citySlug: string;
  excludedUserId?: string;
};

export async function ensureActiveSeriesMaterializedThrough(
  throughInstant: Date,
  filters: PublicSeriesFilters,
  now = new Date(),
) {
  const through = boundedMaterializationThrough(localDateForInstant(throughInstant), now);
  if (!through) return;
  const series = await prisma.studentAvailabilitySeries.findMany({
    where: {
      status: StudentAvailabilitySeriesStatus.ACTIVE,
      OR: [
        { materializedThrough: null },
        { materializedThrough: { lt: localDateToPrismaDate(through) ?? undefined } },
      ],
      studentProfile: {
        isPublished: true,
        user: {
          role: UserRole.STUDENT,
          emailVerified: true,
          ...(filters.excludedUserId ? { id: { not: filters.excludedUserId } } : {}),
        },
      },
      studentLocation: {
        deletedAt: null,
        city: { slug: filters.citySlug, isActive: true },
      },
      offerings: {
        some: {
          studentTreatment: {
            deletedAt: null,
            treatment: { slug: filters.treatmentSlug, isActive: true },
          },
          supervisor: { deletedAt: null },
        },
      },
    },
    orderBy: [{ studentProfileId: "asc" }, { id: "asc" }],
    take: MAX_SERIES_PER_MATERIALIZATION_OPERATION + 1,
    select: { id: true },
  });
  if (series.length > MAX_SERIES_PER_MATERIALIZATION_OPERATION) {
    console.warn("Public series materialization limit reached", {
      treatmentSlug: filters.treatmentSlug,
      citySlug: filters.citySlug,
    });
  }
  await materializeSeriesIdsSafely(
    series.slice(0, MAX_SERIES_PER_MATERIALIZATION_OPERATION).map((item) => item.id),
    throughInstant,
    now,
  );
}
