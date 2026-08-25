import type { Prisma } from "@/generated/prisma/client";
import {
  StudentAvailabilitySeriesStatus,
  StudentAvailabilitySlotStatus,
} from "@/generated/prisma/enums";
import { MAX_RESOURCE_ROOTS_PER_OPERATION } from "@/lib/availability/limits";
import {
  availabilityRootLockKey,
  locationResourceLockKey,
  lockSchedulingKeys,
  seriesLockKey,
  supervisorResourceLockKey,
  treatmentResourceLockKey,
} from "@/lib/scheduling/locks";

export type SchedulingResourceKind = "location" | "treatment" | "supervisor";

export class ResourceSchedulingLimitError extends Error {
  constructor() {
    super("Resursa este asociată cu prea multe elemente de calendar pentru o singură operație.");
    this.name = "ResourceSchedulingLimitError";
  }
}

function resourceLockKey(kind: SchedulingResourceKind, resourceId: string) {
  if (kind === "location") return locationResourceLockKey(resourceId);
  if (kind === "treatment") return treatmentResourceLockKey(resourceId);
  return supervisorResourceLockKey(resourceId);
}

function seriesWhere(kind: SchedulingResourceKind, resourceId: string) {
  if (kind === "location") return { studentLocationId: resourceId };
  if (kind === "treatment") {
    return { offerings: { some: { studentTreatmentId: resourceId } } };
  }
  return { offerings: { some: { supervisorId: resourceId } } };
}

function slotWhere(kind: SchedulingResourceKind, resourceId: string) {
  if (kind === "location") return { studentLocationId: resourceId };
  if (kind === "treatment") {
    return {
      offerings: { some: { studentTreatmentId: resourceId, removedAt: null } },
    };
  }
  return { offerings: { some: { supervisorId: resourceId, removedAt: null } } };
}

export async function lockSchedulingResourceAndRoots(
  transaction: Prisma.TransactionClient,
  kind: SchedulingResourceKind,
  resourceId: string,
  now: Date,
) {
  await lockSchedulingKeys(transaction, [resourceLockKey(kind, resourceId)]);

  const series = await transaction.studentAvailabilitySeries.findMany({
    where: {
      status: StudentAvailabilitySeriesStatus.ACTIVE,
      ...seriesWhere(kind, resourceId),
    },
    orderBy: { id: "asc" },
    take: MAX_RESOURCE_ROOTS_PER_OPERATION + 1,
    select: { id: true },
  });
  const slots = await transaction.studentAvailabilitySlot.findMany({
    where: {
      status: StudentAvailabilitySlotStatus.ACTIVE,
      endsAt: { gt: now },
      ...slotWhere(kind, resourceId),
    },
    orderBy: { id: "asc" },
    take: MAX_RESOURCE_ROOTS_PER_OPERATION + 1,
    select: { id: true, seriesId: true },
  });

  const rootKeys = [
    ...series.map((item) => seriesLockKey(item.id)),
    ...slots.map(availabilityRootLockKey),
  ];
  if (
    series.length > MAX_RESOURCE_ROOTS_PER_OPERATION ||
    slots.length > MAX_RESOURCE_ROOTS_PER_OPERATION ||
    new Set(rootKeys).size > MAX_RESOURCE_ROOTS_PER_OPERATION
  ) {
    throw new ResourceSchedulingLimitError();
  }
  await lockSchedulingKeys(transaction, rootKeys);
}

export async function schedulingResourceUseCounts(
  transaction: Prisma.TransactionClient,
  kind: SchedulingResourceKind,
  resourceId: string,
  now: Date,
) {
  const activeSeries = await transaction.studentAvailabilitySeries.count({
    where: {
      status: StudentAvailabilitySeriesStatus.ACTIVE,
      ...seriesWhere(kind, resourceId),
    },
  });
  const futureSlots = await transaction.studentAvailabilitySlot.count({
    where: {
      status: StudentAvailabilitySlotStatus.ACTIVE,
      endsAt: { gt: now },
      ...slotWhere(kind, resourceId),
    },
  });
  return { activeSeries, futureSlots };
}
