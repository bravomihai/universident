import "dotenv/config";

import {
  AppointmentReviewAuthorRole,
  AppointmentStatus,
  StudentAvailabilitySlotStatus,
  UserRole,
} from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

const DEMO_PREFIX = "demo_history_";
const APPOINTMENT_IDS = Array.from({ length: 7 }, (_, index) => `${DEMO_PREFIX}appointment_${index + 1}`);
const SLOT_IDS = Array.from({ length: 7 }, (_, index) => `${DEMO_PREFIX}slot_${index + 1}`);
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function assertSafeLocalDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Scriptul demo refuză execuția în production.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nu este configurat.");
  const parsed = new URL(databaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase()) ||
    (parsed.port || "5432") !== "5432" ||
    decodeURIComponent(parsed.pathname.slice(1)) !== "universident"
  ) {
    throw new Error("Scriptul demo poate rula numai pe baza PostgreSQL locală Universident.");
  }
}

async function cleanup() {
  await prisma.$transaction(async (transaction) => {
    await transaction.appointmentReview.deleteMany({
      where: { appointmentId: { in: APPOINTMENT_IDS } },
    });
    await transaction.appointment.deleteMany({
      where: { id: { in: APPOINTMENT_IDS } },
    });
    await transaction.studentAvailabilitySlot.deleteMany({
      where: { id: { in: SLOT_IDS } },
    });
  });
}

async function ensureAssociation(studentProfileId: string) {
  const include = {
    studentTreatment: { include: { treatment: true } },
    studentLocation: true,
    supervisor: true,
  } as const;
  const existing = await prisma.studentTreatmentLocation.findFirst({
    where: {
      studentProfileId,
      isActive: true,
      deletedAt: null,
      studentTreatment: { isActive: true, deletedAt: null },
      studentLocation: { isActive: true, deletedAt: null },
      supervisor: { isActive: true, deletedAt: null },
    },
    include,
  });
  if (existing) return existing;

  const [treatment, city] = await Promise.all([
    prisma.treatment.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.city.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!treatment || !city) {
    throw new Error("Rulează seed-ul catalogului înaintea datelor demo de programări.");
  }

  const studentTreatment = await prisma.studentTreatment.upsert({
    where: { studentProfileId_treatmentId: { studentProfileId, treatmentId: treatment.id } },
    update: { isActive: true, deletedAt: null },
    create: {
      id: `${DEMO_PREFIX}treatment`,
      studentProfileId,
      treatmentId: treatment.id,
      description: "Tratament activat pentru istoricul demonstrativ.",
      durationMinutes: 45,
      isActive: true,
    },
  });
  const location = await prisma.studentLocation.upsert({
    where: { id: `${DEMO_PREFIX}location` },
    update: { studentProfileId, cityId: city.id, isActive: true, deletedAt: null },
    create: {
      id: `${DEMO_PREFIX}location`,
      studentProfileId,
      cityId: city.id,
      routeKey: "demo001",
      name: "Clinica demonstrativă",
      address: "Strada Clinicii 10",
      details: "Locație locală pentru testarea programărilor.",
      isActive: true,
    },
  });
  const supervisor = await prisma.studentSupervisor.upsert({
    where: { id: `${DEMO_PREFIX}supervisor` },
    update: { studentProfileId, isActive: true, deletedAt: null },
    create: {
      id: `${DEMO_PREFIX}supervisor`,
      studentProfileId,
      fullName: "Andrei Popescu",
      academicTitle: "Dr.",
      isActive: true,
    },
  });
  return prisma.studentTreatmentLocation.upsert({
    where: { id: `${DEMO_PREFIX}association` },
    update: {
      studentProfileId,
      studentTreatmentId: studentTreatment.id,
      studentLocationId: location.id,
      supervisorId: supervisor.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: `${DEMO_PREFIX}association`,
      studentProfileId,
      studentTreatmentId: studentTreatment.id,
      studentLocationId: location.id,
      supervisorId: supervisor.id,
      isActive: true,
    },
    include,
  });
}

function intervalDaysAgo(daysAgo: number) {
  const endsAt = new Date(Date.now() - daysAgo * 86_400_000);
  endsAt.setUTCMinutes(0, 0, 0);
  const startsAt = new Date(endsAt.getTime() - 45 * 60_000);
  return { startsAt, endsAt };
}

async function seed() {
  const realUsers = await prisma.user.findMany({
    where: { email: { not: { endsWith: "@demo.universident.invalid" } } },
    include: { patientProfile: true, studentProfile: true },
  });
  const patients = realUsers.filter((user) => user.role === UserRole.PATIENT);
  const students = realUsers.filter((user) => user.role === UserRole.STUDENT);
  if (patients.length !== 1 || students.length !== 1) {
    throw new Error("Scriptul așteaptă exact un pacient și un student real în baza locală.");
  }
  const patientUser = patients[0];
  const studentUser = students[0];
  if (!studentUser.studentProfile) {
    throw new Error("Contul studentului nu are încă profil profesional.");
  }
  const patientProfile = patientUser.patientProfile ?? await prisma.patientProfile.create({
    data: {
      id: `${DEMO_PREFIX}patient_profile`,
      userId: patientUser.id,
      profileSlug: `${DEMO_PREFIX}patient_${patientUser.id.slice(-8)}`,
      dateOfBirth: new Date("1990-01-15T00:00:00.000Z"),
    },
  });
  if (!patientProfile.dateOfBirth) {
    await prisma.patientProfile.update({
      where: { id: patientProfile.id },
      data: { dateOfBirth: new Date("1990-01-15T00:00:00.000Z") },
    });
  }
  const association = await ensureAssociation(studentUser.studentProfile.id);
  await cleanup();

  const scenarios = [
    { status: AppointmentStatus.CONFIRMED, daysAgo: 1, note: "Am avut sensibilitate și am dorit să discutăm opțiunile înainte de tratament." },
    { status: AppointmentStatus.COMPLETED, daysAgo: 3, note: "Aș prefera să îmi explicați fiecare etapă a procedurii." },
    { status: AppointmentStatus.COMPLETED, daysAgo: 7, note: "Este prima mea vizită pentru acest tratament." },
    { status: AppointmentStatus.NO_SHOW, daysAgo: 10, note: "Vă rog să îmi confirmați adresa exactă a clinicii." },
    { status: AppointmentStatus.CANCELLED_BY_PATIENT, daysAgo: 14, note: "Am o sensibilitate accentuată la rece." },
    { status: AppointmentStatus.CANCELLED_BY_STUDENT, daysAgo: 21, note: "Doresc o consultație înainte de a decide tratamentul." },
    { status: AppointmentStatus.REJECTED, daysAgo: 28, note: "Pot veni și puțin mai devreme dacă este nevoie." },
  ] as const;

  await prisma.$transaction(async (transaction) => {
    for (const [index, scenario] of scenarios.entries()) {
      const { startsAt, endsAt } = intervalDaysAgo(scenario.daysAgo);
      const slotId = SLOT_IDS[index];
      const appointmentId = APPOINTMENT_IDS[index];
      await transaction.studentAvailabilitySlot.create({
        data: {
          id: slotId,
          studentProfileId: studentUser.studentProfile!.id,
          studentTreatmentLocationId: association.id,
          originalStartsAt: startsAt,
          startsAt,
          endsAt,
          status: StudentAvailabilitySlotStatus.ACTIVE,
          isException: false,
          sourceRevision: 0,
        },
      });

      const confirmedAt = scenario.status === AppointmentStatus.REJECTED
        ? null
        : new Date(startsAt.getTime() - 2 * 86_400_000);
      const finishedAt = new Date(endsAt.getTime() + 10 * 60_000);
      const cancelledAt = scenario.status === AppointmentStatus.CANCELLED_BY_PATIENT
        ? new Date(startsAt.getTime() - 30 * 60_000)
        : scenario.status === AppointmentStatus.CANCELLED_BY_STUDENT
          ? new Date(startsAt.getTime() - 24 * 60 * 60_000)
          : null;
      await transaction.appointment.create({
        data: {
          id: appointmentId,
          routeSlug: `istoric-demo-${index + 1}`,
          patientProfileId: patientProfile.id,
          studentProfileId: studentUser.studentProfile!.id,
          studentAvailabilitySlotId: slotId,
          scheduledStartsAt: startsAt,
          scheduledEndsAt: endsAt,
          patientAgeAtAppointment: 36,
          patientNote: scenario.note,
          patientNameSnapshot: patientUser.name,
          studentNameSnapshot: studentUser.name,
          treatmentNameSnapshot: association.studentTreatment.treatment.name,
          locationNameSnapshot: association.studentLocation.name,
          locationAddressSnapshot: association.studentLocation.address,
          supervisorNameSnapshot: [association.supervisor.academicTitle, association.supervisor.fullName].filter(Boolean).join(" "),
          status: scenario.status,
          version: scenario.status === AppointmentStatus.CONFIRMED ? 2 : 3,
          statusReason: scenario.status === AppointmentStatus.CANCELLED_BY_PATIENT
            ? "A intervenit o situație personală și nu am mai putut ajunge la clinică."
            : scenario.status === AppointmentStatus.CANCELLED_BY_STUDENT
              ? "Programul clinicii s-a schimbat și programarea nu a mai putut fi păstrată."
              : scenario.status === AppointmentStatus.REJECTED
                ? "Tratamentul solicitat nu a putut fi preluat în intervalul selectat."
                : null,
          statusReasonCode: scenario.status === AppointmentStatus.CANCELLED_BY_PATIENT
            ? "PATIENT_CANCELLED"
            : scenario.status === AppointmentStatus.CANCELLED_BY_STUDENT
              ? "STUDENT_CANCELLED"
              : scenario.status === AppointmentStatus.REJECTED
                ? "STUDENT_REJECTED"
                : null,
          statusChangedAt: cancelledAt ?? finishedAt,
          statusChangedByUserId: scenario.status === AppointmentStatus.CANCELLED_BY_PATIENT
            ? patientUser.id
            : studentUser.id,
          isLateCancellation: scenario.status === AppointmentStatus.CANCELLED_BY_PATIENT,
          confirmedAt,
          rejectedAt: scenario.status === AppointmentStatus.REJECTED ? finishedAt : null,
          cancelledAt,
          completedAt: scenario.status === AppointmentStatus.COMPLETED ? finishedAt : null,
          noShowAt: scenario.status === AppointmentStatus.NO_SHOW ? finishedAt : null,
        },
      });
    }

    const reviewPairs = [
      { appointmentIndex: 1, patient: false, studentRating: 5, patientRating: 0 },
      { appointmentIndex: 2, patient: true, studentRating: 5, patientRating: 5 },
      { appointmentIndex: 3, patient: true, studentRating: 2, patientRating: 3 },
    ];
    for (const pair of reviewPairs) {
      const appointmentId = APPOINTMENT_IDS[pair.appointmentIndex];
      const publishedAt = pair.patient ? new Date() : null;
      await transaction.appointmentReview.create({
        data: {
          id: `${DEMO_PREFIX}review_student_${pair.appointmentIndex + 1}`,
          appointmentId,
          authorUserId: studentUser.id,
          targetUserId: patientUser.id,
          authorRole: AppointmentReviewAuthorRole.STUDENT,
          rating: pair.studentRating,
          comment: pair.appointmentIndex === 3
            ? "Pacientul nu s-a prezentat și nu a anunțat înainte."
            : "Pacient punctual, cooperant și atent la recomandări.",
          publishedAt,
        },
      });
      if (pair.patient) {
        await transaction.appointmentReview.create({
          data: {
            id: `${DEMO_PREFIX}review_patient_${pair.appointmentIndex + 1}`,
            appointmentId,
            authorUserId: patientUser.id,
            targetUserId: studentUser.id,
            authorRole: AppointmentReviewAuthorRole.PATIENT,
            rating: pair.patientRating,
            comment: pair.appointmentIndex === 3
              ? "Nu am mai reușit să ajung, dar comunicarea inițială a fost clară."
              : "Totul a fost explicat clar, iar experiența a fost foarte bună.",
            publishedAt,
          },
        });
      }
    }
  });

  console.log(`Au fost create 7 programări demo pentru ${patientUser.name} și ${studentUser.name}.`);
  console.log("Stări: necesită închidere, necesită recenzia pacientului, recenzate bilateral, neprezentare și anulări arhivate.");
}

async function main() {
  assertSafeLocalDatabase();
  const operation = process.argv[2];
  if (operation === "cleanup") {
    await cleanup();
    console.log("Programările demo au fost șterse.");
    return;
  }
  if (operation !== "seed") throw new Error("Folosește `seed` sau `cleanup`.");
  await seed();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
