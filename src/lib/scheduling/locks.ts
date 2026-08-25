import type { Prisma } from "@/generated/prisma/client";

const LOCK_NAMESPACE = "universident:scheduling";

export function seriesLockKey(seriesId: string) {
  return `series:${seriesId}`;
}

export function slotLockKey(slotId: string) {
  return `slot:${slotId}`;
}

export function patientBookingLockKey(userId: string) {
  return `patient:${userId}`;
}

export function studentCalendarLockKey(studentProfileId: string) {
  return `student-calendar:${studentProfileId}`;
}

export function locationResourceLockKey(locationId: string) {
  return `resource:location:${locationId}`;
}

export function treatmentResourceLockKey(treatmentId: string) {
  return `resource:treatment:${treatmentId}`;
}

export function supervisorResourceLockKey(supervisorId: string) {
  return `resource:supervisor:${supervisorId}`;
}

export function availabilityRootLockKey(slot: { id: string; seriesId: string | null }) {
  return slot.seriesId ? seriesLockKey(slot.seriesId) : slotLockKey(slot.id);
}

export function normalizeSchedulingLockKeys(keys: Iterable<string>) {
  return [...new Set(keys)].sort((first, second) =>
    first < second ? -1 : first > second ? 1 : 0,
  );
}

export async function lockSchedulingKeys(
  transaction: Prisma.TransactionClient,
  keys: Iterable<string>,
) {
  for (const key of normalizeSchedulingLockKeys(keys)) {
    const namespacedKey = `${LOCK_NAMESPACE}:${key}`;
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${namespacedKey}, 0))`;
  }
}

export async function findAndLockAvailabilityRoot(
  transaction: Prisma.TransactionClient,
  slotId: string,
  studentProfileId?: string,
) {
  const hint = await transaction.studentAvailabilitySlot.findFirst({
    where: { id: slotId, ...(studentProfileId ? { studentProfileId } : {}) },
    select: { id: true, seriesId: true },
  });
  if (!hint) return null;
  await lockSchedulingKeys(transaction, [availabilityRootLockKey(hint)]);
  return hint;
}
