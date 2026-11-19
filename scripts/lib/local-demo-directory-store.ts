import type { Prisma } from "../../src/generated/prisma/client";
import { assertDemoCalendarSafe, assertDemoIdentities, type DemoDirectoryPlan } from "./local-demo-directory";

type DirectoryClient = Pick<Prisma.TransactionClient,
  "user" | "studentProfile" | "studentLocation" | "studentTreatment" |
  "studentAvailabilitySlot" | "studentAvailabilitySlotOffering" | "appointment" | "studentAvailabilitySeries"
>;

function ids(rows: { id?: string }[]) {
  return rows.map((row) => {
    if (!row.id) throw new Error("A demo record is missing its stable identifier.");
    return row.id;
  });
}

function identities<T extends { id?: string }>(rows: T[], identity: (row: T) => unknown[]) {
  return rows.map((row) => ({ id: ids([row])[0], identity: JSON.stringify(identity(row)) }));
}

// Also called inside the SERIALIZABLE transaction, before any fixture is changed.
export async function validateDemoDirectory(client: DirectoryClient, plan: DemoDirectoryPlan) {
  const profileIds = ids(plan.profiles);
  const slotIds = ids(plan.slots);
  const [users, profiles, locations, treatments, slots, offerings, dependentAppointments, activeSeries] = await Promise.all([
    client.user.findMany({
      where: { OR: [{ id: { in: ids(plan.users) } }, { email: { in: plan.users.map((row) => row.email) } }] },
      select: { id: true, email: true, role: true },
    }),
    client.studentProfile.findMany({
      where: { OR: [{ id: { in: profileIds } }, { userId: { in: ids(plan.users) } }, { publicSlug: { in: plan.profiles.map((row) => row.publicSlug!) } }] },
      select: { id: true, userId: true, publicSlug: true },
    }),
    client.studentLocation.findMany({
      where: { OR: [{ id: { in: ids(plan.locations) } }, { studentProfileId: { in: profileIds } }] },
      select: { id: true, studentProfileId: true, routeKey: true },
    }),
    client.studentTreatment.findMany({
      where: { OR: [{ id: { in: ids(plan.treatments) } }, { studentProfileId: { in: profileIds } }] },
      select: { id: true, studentProfileId: true, treatmentId: true },
    }),
    client.studentAvailabilitySlot.findMany({
      where: { OR: [{ id: { in: slotIds } }, { studentProfileId: { in: profileIds } }] },
      select: { id: true, studentProfileId: true, studentLocationId: true, seriesId: true, startsAt: true, endsAt: true, status: true },
    }),
    client.studentAvailabilitySlotOffering.findMany({
      where: { OR: [{ id: { in: ids(plan.offerings) } }, { slotId: { in: slotIds } }] },
      select: { id: true, studentProfileId: true, slotId: true, studentTreatmentId: true },
    }),
    client.appointment.count({ where: { studentAvailabilitySlotId: { in: slotIds } } }),
    client.studentAvailabilitySeries.count({ where: { studentProfileId: { in: profileIds }, status: "ACTIVE" } }),
  ]);

  assertDemoIdentities("demo users", identities(plan.users, (row) => [row.email, row.role]), identities(users, (row) => [row.email, row.role]));
  assertDemoIdentities("demo profiles", identities(plan.profiles, (row) => [row.userId, row.publicSlug]), identities(profiles, (row) => [row.userId, row.publicSlug]));
  // userId and publicSlug are individually unique as well as part of the identity above.
  assertDemoIdentities("demo profile owners", identities(plan.profiles, (row) => [row.userId]), identities(profiles, (row) => [row.userId]));
  assertDemoIdentities("demo profile URLs", identities(plan.profiles, (row) => [row.publicSlug]), identities(profiles, (row) => [row.publicSlug]));
  assertDemoIdentities("demo email addresses", identities(plan.users, (row) => [row.email]), identities(users, (row) => [row.email]));
  assertDemoIdentities("demo locations", identities(plan.locations, (row) => [row.studentProfileId, row.routeKey]), identities(locations, (row) => [row.studentProfileId, row.routeKey]));
  assertDemoIdentities("demo treatments", identities(plan.treatments, (row) => [row.studentProfileId, row.treatmentId]), identities(treatments, (row) => [row.studentProfileId, row.treatmentId]));
  assertDemoIdentities("demo slots", identities(plan.slots, (row) => [row.id, row.studentProfileId, row.studentLocationId, row.seriesId]), identities(slots, (row) => [row.id, row.studentProfileId, row.studentLocationId, row.seriesId]));
  assertDemoIdentities("demo offerings", identities(plan.offerings, (row) => [row.id, row.studentProfileId, row.slotId, row.studentTreatmentId]), identities(offerings, (row) => [row.id, row.studentProfileId, row.slotId, row.studentTreatmentId]));
  const offeringIds = new Set(ids(plan.offerings));
  if (offerings.some((offering) => !offeringIds.has(offering.id))) {
    throw new Error("Demo slots have manually added offerings. The demo seed cannot reset this calendar.");
  }
  assertDemoCalendarSafe(plan, slots, dependentAppointments, activeSeries);
  return { users, profiles, locations, treatments, slots, offerings };
}

async function syncRows<T extends { id?: string }>(
  planned: T[], existing: { id: string }[],
  create: (rows: T[]) => Promise<unknown>, update: (row: T) => Promise<unknown>,
) {
  const existingIds = new Set(ids(existing));
  const missing = planned.filter((row) => !existingIds.has(row.id!));
  // Batch the first population; don't hide unexpected unique-key conflicts with skipDuplicates.
  if (missing.length > 0) await create(missing);
  for (const row of planned) {
    if (existingIds.has(row.id!)) await update(row);
  }
}

export async function writeDemoDirectory(
  transaction: DirectoryClient,
  plan: DemoDirectoryPlan,
  existing: Awaited<ReturnType<typeof validateDemoDirectory>>,
  now: Date,
) {
  await syncRows(plan.users, existing.users,
    (data) => transaction.user.createMany({ data }),
    (row) => transaction.user.update({ where: { id: row.id }, data: { name: row.name, emailVerified: true, signupPolicyVersion: row.signupPolicyVersion, signupPolicyConfirmedAt: row.signupPolicyConfirmedAt } }));
  await syncRows(plan.profiles, existing.profiles,
    (data) => transaction.studentProfile.createMany({ data }),
    (row) => transaction.studentProfile.update({ where: { id: row.id }, data: row }));
  await syncRows(plan.locations, existing.locations,
    (data) => transaction.studentLocation.createMany({ data }),
    (row) => transaction.studentLocation.update({ where: { id: row.id }, data: row }));
  await syncRows(plan.treatments, existing.treatments,
    (data) => transaction.studentTreatment.createMany({ data }),
    (row) => transaction.studentTreatment.update({ where: { id: row.id }, data: row }));
  // Release only our own unoccupied intervals before shifting them relative to today.
  await transaction.studentAvailabilitySlot.updateMany({
    where: { id: { in: ids(plan.slots) } }, data: { status: "CANCELLED", cancelledAt: now },
  });
  await syncRows(plan.slots, existing.slots,
    (data) => transaction.studentAvailabilitySlot.createMany({ data }),
    (row) => transaction.studentAvailabilitySlot.update({ where: { id: row.id }, data: { ...row, version: { increment: 1 } } }));
  await syncRows(plan.offerings, existing.offerings,
    (data) => transaction.studentAvailabilitySlotOffering.createMany({ data }),
    (row) => transaction.studentAvailabilitySlotOffering.update({ where: { id: row.id }, data: row }));
}
