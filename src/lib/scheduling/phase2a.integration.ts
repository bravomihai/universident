import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AppointmentStatus,
  StudentAvailabilityEndMode,
  StudentAvailabilitySeriesStatus,
  StudentAvailabilitySlotStatus,
  StudentAvailabilityWeekday,
  UserRole,
} from "@/generated/prisma/enums";
import { parseCreateAppointmentInput } from "@/lib/appointments/appointment-input";
import {
  AppointmentDomainError,
  createAppointmentRequest,
} from "@/lib/appointments/appointment-service";
import { parseCancelAvailabilityInput, parseUpdateAvailabilityInput } from "@/lib/availability/availability-input";
import {
  cancelAvailability,
  updateAvailability,
} from "@/lib/availability/availability-service";
import { materializeSeriesThrough } from "@/lib/availability/materializer";
import { listPublicStudentAvailability } from "@/lib/availability/public-availability-service";
import { archiveStudentSchedulingResource, ResourceArchiveDomainError } from "@/lib/availability/resource-archive-service";
import { prisma } from "@/lib/prisma";
import {
  StudentTreatmentDomainError,
  updateStudentTreatment,
} from "@/lib/student-treatments/student-treatment-service";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

const databaseName = (() => {
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").pathname.slice(1));
  } catch {
    return "";
  }
})();
const integrationEnabled =
  process.env.PHASE2A_INTEGRATION === "1" &&
  /^universident_phase2a_test_\d{8,}$/.test(databaseName);
const integrationSkip = integrationEnabled
  ? false
  : "requires PHASE2A_INTEGRATION=1 and an explicit universident_phase2a_test_<timestamp> database";

const NOW = new Date("2026-08-16T06:00:00.000Z");
const ALL_WEEKDAYS = Object.values(StudentAvailabilityWeekday);
const TERMINAL_STATUSES_REQUIRING_REASON = new Set<AppointmentStatus>([
  AppointmentStatus.REJECTED,
  AppointmentStatus.SUPERSEDED,
  AppointmentStatus.EXPIRED,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_STUDENT,
]);

function controlledBarrier() {
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  return {
    waitUntilReached: () => reachedPromise,
    pause: async () => { reached(); await gate; },
    release,
  };
}

async function assertStillWaiting(settled: () => boolean) {
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(settled(), false, "the competing transaction must be waiting on the advisory lock");
}

async function resetDatabase() {
  assert.match(databaseName, /^universident_phase2a_test_\d{8,}$/);
  await prisma.$executeRaw`TRUNCATE TABLE "user", "city", "treatment" RESTART IDENTITY CASCADE`;
}

async function createFixture() {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentUser = await prisma.user.create({
    data: {
      id: `student-${token}`,
      name: "Student Test",
      email: `student-${token}@example.test`,
      emailVerified: true,
      role: UserRole.STUDENT,
    },
  });
  const student = await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      publicSlug: `student-${token}`,
      university: "UMF Test",
      studyYear: 5,
      isPublished: true,
      publishedAt: NOW,
    },
  });
  const city = await prisma.city.create({
    data: { name: `Oraș ${token}`, slug: `oras-${token}` },
  });
  const location = await prisma.studentLocation.create({
    data: {
      studentProfileId: student.id,
      cityId: city.id,
      routeKey: token.slice(0, 6),
      name: "Clinica Test",
      address: "Strada Test 1",
    },
  });
  const catalogTreatment = await prisma.treatment.create({
    data: {
      name: `Tratament ${token}`,
      slug: `tratament-${token}`,
      description: "Tratament pentru testele Phase 2A.",
    },
  });
  const studentTreatment = await prisma.studentTreatment.create({
    data: {
      studentProfileId: student.id,
      treatmentId: catalogTreatment.id,
      durationMinutes: 45,
    },
  });
  const supervisor = await prisma.studentSupervisor.create({
    data: {
      studentProfileId: student.id,
      fullName: "Dr. Supervizor Test",
    },
  });
  return {
    studentUser,
    student,
    city,
    location,
    catalogTreatment,
    studentTreatment,
    supervisor,
  };
}

async function createPatient(label: string) {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const user = await prisma.user.create({
    data: {
      id: `patient-${label}-${token}`,
      name: `Pacient ${label}`,
      email: `patient-${label}-${token}@example.test`,
      emailVerified: true,
      role: UserRole.PATIENT,
    },
  });
  const profile = await prisma.patientProfile.create({
    data: {
      userId: user.id,
      profileSlug: `pacient-${label}-${token}`,
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
    },
  });
  return { user, profile };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createSlot(
  fixture: Fixture,
  startsAt: Date,
  durationMinutes = 45,
  seriesId: string | null = null,
) {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const slot = await prisma.studentAvailabilitySlot.create({
    data: {
      studentProfileId: fixture.student.id,
      studentLocationId: fixture.location.id,
      seriesId,
      sequenceNumber: seriesId ? 999 : null,
      sourceRevision: seriesId ? 1 : 0,
      originalStartsAt: startsAt,
      startsAt,
      endsAt,
    },
  });
  const offering = await prisma.studentAvailabilitySlotOffering.create({
    data: {
      slotId: slot.id,
      studentProfileId: fixture.student.id,
      studentTreatmentId: fixture.studentTreatment.id,
      supervisorId: fixture.supervisor.id,
    },
  });
  return { slot, offering };
}

async function createSeries(fixture: Fixture, startsOn = "2026-08-17") {
  const series = await prisma.studentAvailabilitySeries.create({
    data: {
      studentProfileId: fixture.student.id,
      studentLocationId: fixture.location.id,
      startsOn: new Date(`${startsOn}T00:00:00.000Z`),
      startMinuteOfDay: 9 * 60,
      weekdays: ALL_WEEKDAYS,
      intervalWeeks: 1,
      durationMinutes: 60,
      endMode: StudentAvailabilityEndMode.NEVER,
    },
  });
  await prisma.studentAvailabilitySeriesOffering.create({
    data: {
      seriesId: series.id,
      studentProfileId: fixture.student.id,
      studentTreatmentId: fixture.studentTreatment.id,
      supervisorId: fixture.supervisor.id,
    },
  });
  return series;
}

function bookingInput(
  slot: { id: string; startsAt: Date },
  offeringId: string,
  idempotencyKey = `phase2a_${randomUUID().replaceAll("-", "")}`,
) {
  const parsed = parseCreateAppointmentInput({
    slotId: slot.id,
    offeringId,
    startsAt: slot.startsAt.toISOString(),
    patientNote: null,
    dateOfBirth: null,
    idempotencyKey,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("booking fixture input is invalid");
  return parsed.data;
}

async function createHistoricalAppointment(
  fixture: Fixture,
  patient: Awaited<ReturnType<typeof createPatient>>,
  source: Awaited<ReturnType<typeof createSlot>>,
  status: AppointmentStatus,
) {
  return prisma.appointment.create({
    data: {
      routeSlug: `istoric-${status.toLowerCase()}-${randomUUID()}`,
      patientProfileId: patient.profile.id,
      studentProfileId: fixture.student.id,
      studentAvailabilitySlotId: source.slot.id,
      studentAvailabilitySlotOfferingId: source.offering.id,
      scheduledStartsAt: source.slot.startsAt,
      scheduledEndsAt: source.slot.endsAt,
      patientAgeAtAppointment: 36,
      patientNameSnapshot: patient.user.name,
      studentNameSnapshot: fixture.studentUser.name,
      treatmentNameSnapshot: fixture.catalogTreatment.name,
      locationNameSnapshot: fixture.location.name,
      locationAddressSnapshot: fixture.location.address,
      supervisorNameSnapshot: fixture.supervisor.fullName,
      status,
      statusReason: TERMINAL_STATUSES_REQUIRING_REASON.has(status)
        ? "Motiv terminal pentru verificarea integrității istoricului."
        : null,
      pendingExpiresAt: status === AppointmentStatus.PENDING
        ? new Date("2026-08-17T06:00:00.000Z")
        : null,
    },
  });
}

test("Phase 2A PostgreSQL scheduling integration", { skip: integrationSkip }, async (suite) => {
  await suite.test("idempotency hash columns enforce an all-null or valid-hash pair", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const patient = await createPatient("idempotency-constraint");
    const source = await createSlot(fixture, new Date("2026-09-01T06:00:00.000Z"));
    const appointment = await createHistoricalAppointment(
      fixture,
      patient,
      source,
      AppointmentStatus.CONFIRMED,
    );
    const [storedNullPair] = await prisma.$queryRaw<Array<{
      idempotencyKeyHash: string | null;
      idempotencyRequestHash: string | null;
    }>>`
      SELECT "idempotencyKeyHash", "idempotencyRequestHash"
      FROM "appointment"
      WHERE "id" = ${appointment.id}
    `;
    assert.equal(storedNullPair?.idempotencyKeyHash, null);
    assert.equal(storedNullPair?.idempotencyRequestHash, null);

    const validKeyHash = "a".repeat(64);
    const validRequestHash = "b".repeat(64);
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        idempotencyKeyHash: validKeyHash,
        idempotencyRequestHash: validRequestHash,
      },
    });

    await assert.rejects(prisma.appointment.update({
      where: { id: appointment.id },
      data: { idempotencyKeyHash: null, idempotencyRequestHash: validRequestHash },
    }));
    await assert.rejects(prisma.appointment.update({
      where: { id: appointment.id },
      data: { idempotencyKeyHash: validKeyHash, idempotencyRequestHash: null },
    }));
    await assert.rejects(prisma.appointment.update({
      where: { id: appointment.id },
      data: { idempotencyKeyHash: "not-a-valid-hash", idempotencyRequestHash: validRequestHash },
    }));
  });

  await suite.test("cancellation waits for materialization and leaves no ghost-bookable slots", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const series = await createSeries(fixture);
    await runSerializableTransaction(prisma, (transaction) =>
      materializeSeriesThrough(transaction, series.id, "2026-08-31", { now: NOW }),
    );
    const selected = await prisma.studentAvailabilitySlot.findFirstOrThrow({
      where: { seriesId: series.id, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    const barrier = controlledBarrier();
    const materializing = runSerializableTransaction(prisma, (transaction) =>
      materializeSeriesThrough(transaction, series.id, "2026-09-15", {
        now: NOW,
        afterLock: barrier.pause,
      }),
    );
    await barrier.waitUntilReached();
    const parsedCancel = parseCancelAvailabilityInput({
      scope: "SERIES",
      expectedVersion: selected.version,
      expectedSeriesRevision: series.revision,
      appointmentReason: null,
    });
    assert.equal(parsedCancel.ok, true);
    if (!parsedCancel.ok) throw new Error("cancel fixture input is invalid");
    let cancellationSettled = false;
    const cancelling = cancelAvailability(
      fixture.student.id,
      fixture.studentUser.id,
      selected.id,
      parsedCancel.data,
    ).finally(() => { cancellationSettled = true; });
    await assertStillWaiting(() => cancellationSettled);
    barrier.release();
    await materializing;
    await cancelling;
    const [storedSeries, activeFutureSlots] = await Promise.all([
      prisma.studentAvailabilitySeries.findUniqueOrThrow({ where: { id: series.id } }),
      prisma.studentAvailabilitySlot.count({
        where: {
          seriesId: series.id,
          status: StudentAvailabilitySlotStatus.ACTIVE,
          startsAt: { gt: new Date() },
        },
      }),
    ]);
    assert.equal(storedSeries.status, StudentAvailabilitySeriesStatus.CANCELLED);
    assert.equal(activeFutureSlots, 0);

    const ghost = await createSlot(fixture, new Date("2026-09-20T06:00:00.000Z"), 45, series.id);
    const patient = await createPatient("ghost");
    await assert.rejects(
      createAppointmentRequest(
        { id: patient.user.id, name: patient.user.name },
        fixture.student.publicSlug!,
        bookingInput(ghost.slot, ghost.offering.id),
        { now: NOW },
      ),
      (error) => error instanceof AppointmentDomainError && error.code === "SLOT_UNAVAILABLE",
    );
  });

  await suite.test("same-slot races, pending limit and idempotency stay atomic", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const firstPatient = await createPatient("race-a");
    const secondPatient = await createPatient("race-b");
    const contested = await createSlot(fixture, new Date("2026-09-01T06:00:00.000Z"));
    const rootBarrier = controlledBarrier();
    const first = createAppointmentRequest(
      { id: firstPatient.user.id, name: firstPatient.user.name },
      fixture.student.publicSlug!,
      bookingInput(contested.slot, contested.offering.id),
      { now: NOW, afterRootLock: rootBarrier.pause },
    );
    await rootBarrier.waitUntilReached();
    let secondSettled = false;
    const second = createAppointmentRequest(
      { id: secondPatient.user.id, name: secondPatient.user.name },
      fixture.student.publicSlug!,
      bookingInput(contested.slot, contested.offering.id),
      { now: NOW },
    ).finally(() => { secondSettled = true; });
    await assertStillWaiting(() => secondSettled);
    rootBarrier.release();
    await first;
    await assert.rejects(
      second,
      (error) => error instanceof AppointmentDomainError && error.code === "SLOT_UNAVAILABLE",
    );
    assert.equal(await prisma.appointment.count(), 1);

    await resetDatabase();
    const pendingFixture = await createFixture();
    const patient = await createPatient("pending");
    const existingOne = await createSlot(pendingFixture, new Date("2026-09-02T06:00:00.000Z"));
    const existingTwo = await createSlot(pendingFixture, new Date("2026-09-03T06:00:00.000Z"));
    await createHistoricalAppointment(pendingFixture, patient, existingOne, AppointmentStatus.PENDING).then((appointment) =>
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { pendingExpiresAt: new Date("2026-08-17T06:00:00.000Z") },
      }),
    );
    await createHistoricalAppointment(pendingFixture, patient, existingTwo, AppointmentStatus.PENDING).then((appointment) =>
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { pendingExpiresAt: new Date("2026-08-17T06:00:00.000Z") },
      }),
    );
    const candidateOne = await createSlot(pendingFixture, new Date("2026-09-04T06:00:00.000Z"));
    const candidateTwo = await createSlot(pendingFixture, new Date("2026-09-05T06:00:00.000Z"));
    const patientBarrier = controlledBarrier();
    const third = createAppointmentRequest(
      { id: patient.user.id, name: patient.user.name },
      pendingFixture.student.publicSlug!,
      bookingInput(candidateOne.slot, candidateOne.offering.id),
      { now: NOW, afterPatientLock: patientBarrier.pause },
    );
    await patientBarrier.waitUntilReached();
    let fourthSettled = false;
    const fourth = createAppointmentRequest(
      { id: patient.user.id, name: patient.user.name },
      pendingFixture.student.publicSlug!,
      bookingInput(candidateTwo.slot, candidateTwo.offering.id),
      { now: NOW },
    ).finally(() => { fourthSettled = true; });
    await assertStillWaiting(() => fourthSettled);
    patientBarrier.release();
    await third;
    await assert.rejects(
      fourth,
      (error) => error instanceof AppointmentDomainError && error.code === "PENDING_LIMIT_REACHED",
    );
    assert.equal(
      await prisma.appointment.count({
        where: { patientProfileId: patient.profile.id, status: AppointmentStatus.PENDING },
      }),
      3,
    );

    const idempotentPatient = await createPatient("idempotent");
    const idempotentSlot = await createSlot(pendingFixture, new Date("2026-09-06T06:00:00.000Z"));
    const idempotencyKey = `phase2a_${randomUUID().replaceAll("-", "")}`;
    const input = bookingInput(idempotentSlot.slot, idempotentSlot.offering.id, idempotencyKey);
    const initial = await createAppointmentRequest(
      { id: idempotentPatient.user.id, name: idempotentPatient.user.name },
      pendingFixture.student.publicSlug!,
      input,
      { now: NOW },
    );
    const repeated = await createAppointmentRequest(
      { id: idempotentPatient.user.id, name: idempotentPatient.user.name },
      pendingFixture.student.publicSlug!,
      input,
      { now: NOW },
    );
    assert.equal(repeated.id, initial.id);
    assert.equal(
      await prisma.appointment.count({ where: { patientProfileId: idempotentPatient.profile.id } }),
      1,
    );
    const differentSlot = await createSlot(pendingFixture, new Date("2026-09-07T06:00:00.000Z"));
    await assert.rejects(
      createAppointmentRequest(
        { id: idempotentPatient.user.id, name: idempotentPatient.user.name },
        pendingFixture.student.publicSlug!,
        bookingInput(differentSlot.slot, differentSlot.offering.id, idempotencyKey),
        { now: NOW },
      ),
      (error) => error instanceof AppointmentDomainError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    const otherPatient = await createPatient("other-idempotency-owner");
    const otherPatientSlot = await createSlot(
      pendingFixture,
      new Date("2026-09-08T06:00:00.000Z"),
    );
    const otherPatientAppointment = await createAppointmentRequest(
      { id: otherPatient.user.id, name: otherPatient.user.name },
      pendingFixture.student.publicSlug!,
      bookingInput(otherPatientSlot.slot, otherPatientSlot.offering.id, idempotencyKey),
      { now: NOW },
    );
    assert.equal(otherPatientAppointment.patientProfileId, otherPatient.profile.id);

    const concurrentPatient = await createPatient("concurrent-idempotency");
    const concurrentSlot = await createSlot(
      pendingFixture,
      new Date("2026-09-09T06:00:00.000Z"),
    );
    const concurrentKey = `phase2a_${randomUUID().replaceAll("-", "")}`;
    const concurrentInput = bookingInput(
      concurrentSlot.slot,
      concurrentSlot.offering.id,
      concurrentKey,
    );
    const idempotencyBarrier = controlledBarrier();
    const concurrentFirst = createAppointmentRequest(
      { id: concurrentPatient.user.id, name: concurrentPatient.user.name },
      pendingFixture.student.publicSlug!,
      concurrentInput,
      { now: NOW, afterPatientLock: idempotencyBarrier.pause },
    );
    await idempotencyBarrier.waitUntilReached();
    let concurrentSecondSettled = false;
    const concurrentSecond = createAppointmentRequest(
      { id: concurrentPatient.user.id, name: concurrentPatient.user.name },
      pendingFixture.student.publicSlug!,
      concurrentInput,
      { now: NOW },
    ).finally(() => { concurrentSecondSettled = true; });
    await assertStillWaiting(() => concurrentSecondSettled);
    idempotencyBarrier.release();
    const [firstConcurrentAppointment, secondConcurrentAppointment] = await Promise.all([
      concurrentFirst,
      concurrentSecond,
    ]);
    assert.equal(secondConcurrentAppointment.id, firstConcurrentAppointment.id);
    assert.equal(
      await prisma.appointment.count({
        where: { patientProfileId: concurrentPatient.profile.id },
      }),
      1,
    );
  });

  await suite.test("expired pending requests release capacity without GET cleanup", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const patient = await createPatient("expired");
    const source = await createSlot(fixture, new Date("2026-09-08T06:00:00.000Z"));
    const pending = await createHistoricalAppointment(
      fixture,
      patient,
      source,
      AppointmentStatus.PENDING,
    );
    await prisma.appointment.update({
      where: { id: pending.id },
      data: { pendingExpiresAt: new Date("2026-08-16T05:00:00.000Z") },
    });
    const availability = await listPublicStudentAvailability(
      fixture.student.publicSlug!,
      fixture.catalogTreatment.slug,
      fixture.city.slug,
      new Date("2026-09-08T00:00:00.000Z"),
      new Date("2026-09-09T00:00:00.000Z"),
    );
    assert.ok(availability && availability.length > 0);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(stored.status, AppointmentStatus.PENDING);
  });

  await suite.test("archive waits for materialization and treatment duration cannot invalidate active calendars", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const series = await createSeries(fixture);
    await runSerializableTransaction(prisma, (transaction) =>
      materializeSeriesThrough(transaction, series.id, "2026-08-18", { now: NOW }),
    );
    const barrier = controlledBarrier();
    const materializing = runSerializableTransaction(prisma, (transaction) =>
      materializeSeriesThrough(transaction, series.id, "2026-09-15", {
        now: NOW,
        afterLock: barrier.pause,
      }),
    );
    await barrier.waitUntilReached();
    let archiveSettled = false;
    const archiving = archiveStudentSchedulingResource(
      "location",
      fixture.student.id,
      fixture.location.id,
    ).finally(() => { archiveSettled = true; });
    await assertStillWaiting(() => archiveSettled);
    barrier.release();
    await materializing;
    await assert.rejects(
      archiving,
      (error) => error instanceof ResourceArchiveDomainError && error.code === "RESOURCE_IN_CALENDAR",
    );
    assert.equal(
      (await prisma.studentLocation.findUniqueOrThrow({ where: { id: fixture.location.id } })).deletedAt,
      null,
    );
    await assert.rejects(
      updateStudentTreatment(fixture.student.id, fixture.studentTreatment.id, { durationMinutes: 75 }),
      (error) => error instanceof StudentTreatmentDomainError && error.code === "RESOURCE_IN_CALENDAR",
    );

    await resetDatabase();
    const ongoingFixture = await createFixture();
    const ongoingSlotStart = new Date(
      Math.floor(Date.now() / (15 * 60_000)) * 15 * 60_000 - 15 * 60_000,
    );
    await createSlot(
      ongoingFixture,
      ongoingSlotStart,
      45,
    );
    await assert.rejects(
      archiveStudentSchedulingResource(
        "location",
        ongoingFixture.student.id,
        ongoingFixture.location.id,
      ),
      (error) => error instanceof ResourceArchiveDomainError && error.code === "RESOURCE_IN_CALENDAR",
    );
    await assert.rejects(
      updateStudentTreatment(
        ongoingFixture.student.id,
        ongoingFixture.studentTreatment.id,
        { durationMinutes: 60 },
      ),
      (error) => error instanceof StudentTreatmentDomainError && error.code === "RESOURCE_IN_CALENDAR",
    );
  });

  await suite.test("all terminal appointment statuses preserve their referenced offering on occurrence edit", async () => {
    await resetDatabase();
    const fixture = await createFixture();
    const patient = await createPatient("terminal");
    const terminalStatuses = [
      AppointmentStatus.REJECTED,
      AppointmentStatus.SUPERSEDED,
      AppointmentStatus.EXPIRED,
      AppointmentStatus.CANCELLED_BY_PATIENT,
      AppointmentStatus.CANCELLED_BY_STUDENT,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    for (const [index, status] of terminalStatuses.entries()) {
      const startsAt = new Date(Date.UTC(2026, 8, 10 + index, 6, 0, 0, 0));
      const source = await createSlot(fixture, startsAt);
      const appointment = await createHistoricalAppointment(fixture, patient, source, status);
      const movedStart = new Date(startsAt.getTime() + 60 * 60_000);
      const movedEnd = new Date(movedStart.getTime() + 45 * 60_000);
      const parsed = parseUpdateAvailabilityInput({
        scope: "OCCURRENCE",
        studentLocationId: fixture.location.id,
        offerings: [{
          studentTreatmentId: fixture.studentTreatment.id,
          supervisorId: fixture.supervisor.id,
        }],
        startsAt: movedStart.toISOString(),
        endsAt: movedEnd.toISOString(),
        expectedVersion: source.slot.version,
        appointmentReason: null,
      }, NOW);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) throw new Error("availability fixture input is invalid");
      await updateAvailability(
        fixture.student.id,
        fixture.studentUser.id,
        source.slot.id,
        parsed.data,
      );
      const [oldOffering, activeOffering, storedAppointment] = await Promise.all([
        prisma.studentAvailabilitySlotOffering.findUniqueOrThrow({ where: { id: source.offering.id } }),
        prisma.studentAvailabilitySlotOffering.findFirstOrThrow({
          where: { slotId: source.slot.id, removedAt: null },
        }),
        prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } }),
      ]);
      assert.ok(oldOffering.removedAt);
      assert.notEqual(activeOffering.id, oldOffering.id);
      assert.equal(storedAppointment.studentAvailabilitySlotOfferingId, oldOffering.id);
    }
  });
});
