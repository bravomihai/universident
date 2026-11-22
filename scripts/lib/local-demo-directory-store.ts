import type { Prisma } from "../../src/generated/prisma/client";
import { assertDemoCalendarSafe, assertDemoIdentities, demoDirectoryPatient, type DemoDirectoryPlan } from "./local-demo-directory";

type DirectoryClient = Pick<Prisma.TransactionClient,
  "user" | "patientProfile" | "studentProfile" | "studentLocation" | "studentTreatment" |
  "studentAvailabilitySlot" | "studentAvailabilitySlotOffering" |
  "appointment" | "appointmentReview" | "studentAvailabilitySeries"
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
  const plannedUsers = [...plan.users, demoDirectoryPatient.user];
  const plannedSlots = [...plan.slots, ...plan.history.slots];
  const plannedOfferings = [...plan.offerings, ...plan.history.offerings];
  const profileIds = ids(plan.profiles);
  const slotIds = ids(plannedSlots);
  const appointmentIds = ids(plan.history.appointments);
  const { profile: patientProfile } = demoDirectoryPatient;
  const [
    users, patients, profiles, locations, treatments, slots, offerings, appointments, reviews, activeSeries,
  ] = await Promise.all([
    client.user.findMany({
      where: { OR: [{ id: { in: ids(plannedUsers) } }, { email: { in: plannedUsers.map((row) => row.email) } }] },
      select: { id: true, email: true, role: true },
    }),
    client.patientProfile.findMany({
      where: { OR: [{ id: patientProfile.id }, { userId: patientProfile.userId }, { profileSlug: patientProfile.profileSlug }] },
      select: { id: true, userId: true, profileSlug: true },
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
      where: { OR: [{ id: { in: ids(plannedOfferings) } }, { slotId: { in: slotIds } }] },
      select: { id: true, studentProfileId: true, slotId: true, studentTreatmentId: true },
    }),
    client.appointment.findMany({
      where: { OR: [
        { id: { in: appointmentIds } },
        { routeSlug: { in: plan.history.appointments.map((row) => row.routeSlug) } },
        { studentAvailabilitySlotId: { in: slotIds } },
      ] },
      select: {
        id: true, routeSlug: true, studentProfileId: true, patientProfileId: true,
        studentAvailabilitySlotId: true, studentAvailabilitySlotOfferingId: true, status: true,
      },
    }),
    client.appointmentReview.findMany({
      where: { OR: [{ id: { in: ids(plan.history.reviews) } }, { appointmentId: { in: appointmentIds } }] },
      select: { id: true, appointmentId: true, authorUserId: true, targetUserId: true, authorRole: true },
    }),
    client.studentAvailabilitySeries.count({ where: { studentProfileId: { in: profileIds }, status: "ACTIVE" } }),
  ]);

  assertDemoIdentities("demo users", identities(plannedUsers, (row) => [row.email, row.role]), identities(users, (row) => [row.email, row.role]));
  assertDemoIdentities("demo patient owner", identities([patientProfile], (row) => [row.userId]), identities(patients, (row) => [row.userId]));
  assertDemoIdentities("demo patient URL", identities([patientProfile], (row) => [row.profileSlug]), identities(patients, (row) => [row.profileSlug]));
  assertDemoIdentities("demo profiles", identities(plan.profiles, (row) => [row.userId, row.publicSlug]), identities(profiles, (row) => [row.userId, row.publicSlug]));
  // userId and publicSlug are individually unique as well as part of the identity above.
  assertDemoIdentities("demo profile owners", identities(plan.profiles, (row) => [row.userId]), identities(profiles, (row) => [row.userId]));
  assertDemoIdentities("demo profile URLs", identities(plan.profiles, (row) => [row.publicSlug]), identities(profiles, (row) => [row.publicSlug]));
  assertDemoIdentities("demo email addresses", identities(plannedUsers, (row) => [row.email]), identities(users, (row) => [row.email]));
  assertDemoIdentities("demo locations", identities(plan.locations, (row) => [row.studentProfileId, row.routeKey]), identities(locations, (row) => [row.studentProfileId, row.routeKey]));
  assertDemoIdentities("demo treatments", identities(plan.treatments, (row) => [row.studentProfileId, row.treatmentId]), identities(treatments, (row) => [row.studentProfileId, row.treatmentId]));
  assertDemoIdentities("demo slots", identities(plannedSlots, (row) => [row.id, row.studentProfileId, row.studentLocationId, row.seriesId]), identities(slots, (row) => [row.id, row.studentProfileId, row.studentLocationId, row.seriesId]));
  assertDemoIdentities("demo offerings", identities(plannedOfferings, (row) => [row.id, row.studentProfileId, row.slotId, row.studentTreatmentId]), identities(offerings, (row) => [row.id, row.studentProfileId, row.slotId, row.studentTreatmentId]));
  assertDemoIdentities("demo appointment URLs",
    identities(plan.history.appointments, (row) => [row.routeSlug]),
    identities(appointments, (row) => [row.routeSlug]));
  const appointmentOwner = (row: Pick<Prisma.AppointmentCreateManyInput,
    "id" | "studentProfileId" | "patientProfileId" | "studentAvailabilitySlotId" | "studentAvailabilitySlotOfferingId" | "status"
  >) => [
    row.id, row.studentProfileId, row.patientProfileId,
    row.studentAvailabilitySlotId, row.studentAvailabilitySlotOfferingId, row.status,
  ];
  assertDemoIdentities("demo appointment ownership",
    identities(plan.history.appointments, appointmentOwner), identities(appointments, appointmentOwner));
  assertDemoIdentities("demo review authors",
    identities(plan.history.reviews, (row) => [row.appointmentId, row.authorUserId]),
    identities(reviews, (row) => [row.appointmentId, row.authorUserId]));
  assertDemoIdentities("demo review targets",
    identities(plan.history.reviews, (row) => [row.id, row.targetUserId, row.authorRole]),
    identities(reviews, (row) => [row.id, row.targetUserId, row.authorRole]));
  const offeringIds = new Set(ids(plannedOfferings));
  if (offerings.some((offering) => !offeringIds.has(offering.id))) {
    throw new Error("Demo slots have manually added offerings. The demo seed cannot reset this calendar.");
  }
  const historicalAppointmentIds = new Set(appointmentIds);
  const managedSlotIds = new Set(slotIds);
  const dependentAppointments = appointments.filter((appointment) =>
    managedSlotIds.has(appointment.studentAvailabilitySlotId) && !historicalAppointmentIds.has(appointment.id));
  assertDemoCalendarSafe(plan, slots, dependentAppointments.length, activeSeries);
  return { users, patients, profiles, locations, treatments, slots, offerings, appointments, reviews };
}

async function createMissingRows<T extends { id?: string }>(
  planned: T[], existingIds: Set<string>, create: (rows: T[]) => Promise<unknown>,
) {
  const missing = planned.filter((row) => !existingIds.has(row.id!));
  // Batch the first population; don't hide unexpected unique-key conflicts with skipDuplicates.
  if (missing.length > 0) await create(missing);
}

async function syncRows<T extends { id?: string }>(
  planned: T[], existing: { id: string }[],
  create: (rows: T[]) => Promise<unknown>, update: (row: T) => Promise<unknown>,
) {
  const existingIds = new Set(ids(existing));
  await createMissingRows(planned, existingIds, create);
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
  await syncRows<Prisma.UserCreateManyInput>([...plan.users, demoDirectoryPatient.user], existing.users,
    (data) => transaction.user.createMany({ data }),
    (row) => transaction.user.update({ where: { id: row.id }, data: { name: row.name, emailVerified: true, signupPolicyVersion: row.signupPolicyVersion, signupPolicyConfirmedAt: row.signupPolicyConfirmedAt } }));
  await createMissingRows([demoDirectoryPatient.profile], new Set(ids(existing.patients)),
    (data) => transaction.patientProfile.createMany({ data }));
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

  // Completed fixture appointments live on separate, fixed slots and are never reset.
  await createMissingRows(plan.history.slots, new Set(ids(existing.slots)),
    (data) => transaction.studentAvailabilitySlot.createMany({ data }));
  await createMissingRows(plan.history.offerings, new Set(ids(existing.offerings)),
    (data) => transaction.studentAvailabilitySlotOffering.createMany({ data }));
  await createMissingRows(plan.history.appointments, new Set(ids(existing.appointments)),
    (data) => transaction.appointment.createMany({ data }));
  await createMissingRows(plan.history.reviews, new Set(ids(existing.reviews)),
    (data) => transaction.appointmentReview.createMany({ data }));
}
