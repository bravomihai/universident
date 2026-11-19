import "dotenv/config";
import type { Prisma } from "../src/generated/prisma/client";

import {
  AppointmentReviewAuthorRole,
  AppointmentStatus,
  StudentAvailabilitySlotStatus,
  UserRole,
} from "../src/generated/prisma/enums";
import {
  addLocalDays,
  ageOnDate,
  localDateForInstant,
  localDateToPrismaDate,
  utcInstantForBucharestLocal,
} from "../src/lib/availability/bucharest-time";
import { prisma } from "../src/lib/prisma";
import { PROFILE_REFRESH_COOLDOWN_MS } from "../src/lib/student-profile/profile-refresh";
import { assertLocalDemoDatabase, parseLocalDemoOptions } from "./lib/local-demo-options";
import { placeLocalDemoSlots } from "./lib/local-demo-schedule";
import { buildDemoDirectory, isDemoDirectoryStudent, type DemoDirectoryPlan } from "./lib/local-demo-directory";
import { validateDemoDirectory, writeDemoDirectory } from "./lib/local-demo-directory-store";

const DEMO_PREFIX = "demo-ui-";

const requiredTreatmentSlugs = [
  "consultatie",
  "igienizare",
  "carii-si-obturatii",
  "tratament-de-canal",
] as const;

const demoSlotKeys = [
  "available-main",
  "pending",
  "confirmed-future",
  "moved-exception",
  "available-secondary",
  "cancelled-hidden",
  "confirmed-overdue",
  "completed-awaiting-patient",
  "completed-reviewed",
  "completed-reviewed-second",
  "no-show-reviewed",
  "cancelled-patient-late",
  "cancelled-patient-normal",
  "cancelled-student",
  "rejected",
  "superseded",
  "expired",
] as const;

type DemoSlotKey = (typeof demoSlotKeys)[number];
type TreatmentKey = (typeof requiredTreatmentSlugs)[number];
type LocationKey = "clinic" | "faculty";

type SlotDefinition = {
  key: DemoSlotKey;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  location: LocationKey;
  treatments: Array<{
    treatment: TreatmentKey;
  }>;
  isException?: boolean;
  isCancelled?: boolean;
};

type AppointmentDefinition = {
  key: Exclude<
    DemoSlotKey,
    "available-main" | "moved-exception" | "available-secondary" | "cancelled-hidden"
  >;
  treatment: TreatmentKey;
  startMinute: number;
  status: AppointmentStatus;
  note?: string | null;
  statusReason?: string | null;
  statusReasonCode?: string | null;
  changedBy: "PATIENT" | "STUDENT" | "SYSTEM";
  confirmed?: boolean;
  isLateCancellation?: boolean;
};

function requiredPrismaDate(value: string) {
  const result = localDateToPrismaDate(value);
  if (!result) throw new Error(`Invalid local date: "${value}".`);
  return result;
}

function requiredInstant(localDate: string, minuteOfDay: number) {
  const result = utcInstantForBucharestLocal(localDate, minuteOfDay);
  if (!result) {
    throw new Error(
      `Demo time ${localDate}, minute ${minuteOfDay}, does not exist in Europe/Bucharest.`,
    );
  }
  return result;
}

function minusMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() - minutes * 60_000);
}

function plusMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function demoId(kind: string, key: string) {
  return `${DEMO_PREFIX}${kind}-${key}`;
}

function printDirectorySummary(directory: DemoDirectoryPlan) {
  const cityCount = new Set(directory.locations.map((location) => location.cityId)).size;
  console.log(`${directory.profiles.length} fictional profiles planned for publication, ${directory.locations.length} locations, and ${directory.slots.length} future slots across ${cityCount} cities.`);
  console.log(`Search coverage for ${directory.profiles.length} demo profiles:`);
  console.table(directory.coverage.map((row) => ({ city: row.city, treatment: row.treatment, profiles: row.profiles })));
}

async function main() {
  const options = parseLocalDemoOptions(process.argv.slice(2));
  assertLocalDemoDatabase(process.env.DATABASE_URL, process.env.NODE_ENV);

  const [catalogTreatments, catalogCities, catalogUniversities] = await Promise.all([
    prisma.treatment.findMany({ where: { isActive: true } }),
    prisma.city.findMany({ where: { isActive: true } }),
    prisma.university.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { shortName: "asc" }],
    }),
  ]);
  const now = new Date();
  const directory = buildDemoDirectory({
    cities: catalogCities, treatments: catalogTreatments, universities: catalogUniversities,
  }, now);

  if (options.directoryOnly) {
    await validateDemoDirectory(prisma, directory);
    printDirectorySummary(directory);
    if (options.dryRun) {
      console.log("Dry run complete. No changes were written. Directory-only mode preserves existing scenarios and accounts outside the fictional profile set.");
      return;
    }
    await prisma.$transaction(async (transaction) => {
      const existing = await validateDemoDirectory(transaction, directory);
      await writeDemoDirectory(transaction, directory, existing, now);
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
    console.log(`${directory.profiles.length} demo profiles are ready. The accounts have no passwords and no emails were sent. See scripts/DEMO-TESTING.md.`);
    return;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      patientProfile: {
        select: {
          id: true,
          profileSlug: true,
          dateOfBirth: true,
          bio: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          publicSlug: true,
          university: true,
          studyYear: true,
          bio: true,
          publishedAt: true,
        },
      },
    },
  });

  const patientUsers = users.filter((user) => user.role === UserRole.PATIENT &&
    (!options.patientEmail || user.email.toLowerCase() === options.patientEmail));
  const studentUsers = users.filter((user) => user.role === UserRole.STUDENT && !isDemoDirectoryStudent(user) &&
    (!options.studentEmail || user.email.toLowerCase() === options.studentEmail));
  if (patientUsers.length !== 1 || studentUsers.length !== 1) {
    throw new Error(
      `Select exactly one existing patient and one existing student. Use --patient-email=<email> and --student-email=<email> to narrow the selection. Matched patient accounts: ${patientUsers.length}. Matched student accounts: ${studentUsers.length}.`,
    );
  }

  const patientUser = patientUsers[0];
  const studentUser = studentUsers[0];
  if (!patientUser.emailVerified || !studentUser.emailVerified) {
    throw new Error("Verify the email addresses for both accounts through the app before seeding demo data.");
  }
  const city = catalogCities.find((candidate) => candidate.slug === "cluj-napoca");
  const defaultUniversity = catalogUniversities[0];
  const missingTreatments = requiredTreatmentSlugs.filter(
    (slug) => !catalogTreatments.some((treatment) => treatment.slug === slug),
  );
  if (missingTreatments.length > 0 || !city || !defaultUniversity) {
    throw new Error(
      "Required catalog data is missing. Run `npx prisma db seed` first, then `npm run demo:seed`.",
    );
  }

  const lastRefreshedAt = options.refresh === "cooldown"
    ? now
    : new Date(now.getTime() - PROFILE_REFRESH_COOLDOWN_MS - 60_000);
  const today = localDateForInstant(now);
  const defaultBirthDate = requiredPrismaDate("1992-04-18");
  const existingBirthDate = patientUser.patientProfile?.dateOfBirth;
  const effectiveBirthDate =
    existingBirthDate && ageOnDate(existingBirthDate, now) >= 18
      ? existingBirthDate
      : defaultBirthDate;

  const slotDefinitions: SlotDefinition[] = [
    {
      key: "available-main",
      dayOffset: 1,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
      location: "clinic",
      treatments: [
        { treatment: "consultatie" },
        { treatment: "igienizare" },
      ],
    },
    {
      key: "pending",
      dayOffset: 2,
      startMinute: 9 * 60,
      endMinute: 13 * 60,
      location: "faculty",
      treatments: [
        { treatment: "consultatie" },
        { treatment: "igienizare" },
      ],
    },
    {
      key: "confirmed-future",
      dayOffset: 3,
      startMinute: 13 * 60,
      endMinute: 17 * 60,
      location: "clinic",
      treatments: [
        { treatment: "carii-si-obturatii" },
        { treatment: "consultatie" },
      ],
    },
    {
      key: "moved-exception",
      dayOffset: 4,
      startMinute: 8 * 60,
      endMinute: 11 * 60,
      location: "faculty",
      treatments: [{ treatment: "igienizare" }],
      isException: true,
    },
    {
      key: "available-secondary",
      dayOffset: 5,
      startMinute: 10 * 60,
      endMinute: 14 * 60,
      location: "clinic",
      treatments: [
        { treatment: "consultatie" },
        { treatment: "carii-si-obturatii" },
      ],
    },
    {
      key: "cancelled-hidden",
      dayOffset: 6,
      startMinute: 10 * 60,
      endMinute: 13 * 60,
      location: "clinic",
      treatments: [{ treatment: "consultatie" }],
      isCancelled: true,
    },
    {
      key: "confirmed-overdue",
      dayOffset: -1,
      startMinute: 8 * 60,
      endMinute: 11 * 60,
      location: "clinic",
      treatments: [{ treatment: "consultatie" }],
    },
    {
      key: "completed-awaiting-patient",
      dayOffset: -3,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      location: "faculty",
      treatments: [{ treatment: "igienizare" }],
    },
    {
      key: "completed-reviewed",
      dayOffset: -5,
      startMinute: 14 * 60,
      endMinute: 18 * 60,
      location: "clinic",
      treatments: [{ treatment: "carii-si-obturatii" }],
    },
    {
      key: "completed-reviewed-second",
      dayOffset: -7,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
      location: "faculty",
      treatments: [{ treatment: "consultatie" }],
    },
    {
      key: "no-show-reviewed",
      dayOffset: -9,
      startMinute: 13 * 60,
      endMinute: 17 * 60,
      location: "clinic",
      treatments: [{ treatment: "consultatie" }],
    },
    {
      key: "cancelled-patient-late",
      dayOffset: -11,
      startMinute: 8 * 60,
      endMinute: 11 * 60,
      location: "faculty",
      treatments: [{ treatment: "igienizare" }],
    },
    {
      key: "cancelled-patient-normal",
      dayOffset: -13,
      startMinute: 13 * 60,
      endMinute: 17 * 60,
      location: "clinic",
      treatments: [{ treatment: "carii-si-obturatii" }],
    },
    {
      key: "cancelled-student",
      dayOffset: -15,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
      location: "faculty",
      treatments: [{ treatment: "consultatie" }],
    },
    {
      key: "rejected",
      dayOffset: -17,
      startMinute: 14 * 60,
      endMinute: 18 * 60,
      location: "clinic",
      treatments: [{ treatment: "carii-si-obturatii" }],
    },
    {
      key: "superseded",
      dayOffset: -19,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      location: "faculty",
      treatments: [{ treatment: "igienizare" }],
    },
    {
      key: "expired",
      dayOffset: -21,
      startMinute: 13 * 60,
      endMinute: 17 * 60,
      location: "clinic",
      treatments: [{ treatment: "consultatie" }],
    },
  ];
  if (
    slotDefinitions.length !== demoSlotKeys.length ||
    demoSlotKeys.some(
      (key) => !slotDefinitions.some((definition) => definition.key === key),
    )
  ) {
    throw new Error("The demo slot list is incomplete.");
  }

  const appointmentDefinitions: AppointmentDefinition[] = [
    {
      key: "pending",
      treatment: "igienizare",
      startMinute: 9 * 60,
      status: AppointmentStatus.PENDING,
      note: "Aș dori o igienizare și o evaluare a sensibilității dentare.",
      changedBy: "PATIENT",
    },
    {
      key: "confirmed-future",
      treatment: "carii-si-obturatii",
      startMinute: 14 * 60 + 30,
      status: AppointmentStatus.CONFIRMED,
      note: "Am o obturație veche care a devenit sensibilă în ultimele zile.",
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "confirmed-overdue",
      treatment: "consultatie",
      startMinute: 8 * 60 + 30,
      status: AppointmentStatus.CONFIRMED,
      note: "Doresc o consultație generală și recomandări pentru pașii următori.",
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "completed-awaiting-patient",
      treatment: "igienizare",
      startMinute: 9 * 60 + 30,
      status: AppointmentStatus.COMPLETED,
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "completed-reviewed",
      treatment: "carii-si-obturatii",
      startMinute: 14 * 60 + 30,
      status: AppointmentStatus.COMPLETED,
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "completed-reviewed-second",
      treatment: "consultatie",
      startMinute: 9 * 60,
      status: AppointmentStatus.COMPLETED,
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "no-show-reviewed",
      treatment: "consultatie",
      startMinute: 14 * 60,
      status: AppointmentStatus.NO_SHOW,
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "cancelled-patient-late",
      treatment: "igienizare",
      startMinute: 8 * 60 + 30,
      status: AppointmentStatus.CANCELLED_BY_PATIENT,
      statusReason: "A apărut o urgență personală chiar înainte de întâlnire.",
      statusReasonCode: "PATIENT_CANCELLED_LATE",
      changedBy: "PATIENT",
      confirmed: true,
      isLateCancellation: true,
    },
    {
      key: "cancelled-patient-normal",
      treatment: "carii-si-obturatii",
      startMinute: 14 * 60,
      status: AppointmentStatus.CANCELLED_BY_PATIENT,
      statusReason: "Programul de lucru s-a schimbat și nu mai pot ajunge la timp.",
      statusReasonCode: "PATIENT_CANCELLED",
      changedBy: "PATIENT",
      confirmed: true,
    },
    {
      key: "cancelled-student",
      treatment: "consultatie",
      startMinute: 9 * 60,
      status: AppointmentStatus.CANCELLED_BY_STUDENT,
      statusReason: "Clinica a modificat programul și nu mai este disponibil cabinetul.",
      statusReasonCode: "STUDENT_CANCELLED",
      changedBy: "STUDENT",
      confirmed: true,
    },
    {
      key: "rejected",
      treatment: "carii-si-obturatii",
      startMinute: 15 * 60,
      status: AppointmentStatus.REJECTED,
      statusReason: "Cazul necesită o evaluare într-o clinică cu dotări suplimentare.",
      statusReasonCode: "STUDENT_REJECTED",
      changedBy: "STUDENT",
    },
    {
      key: "superseded",
      treatment: "igienizare",
      startMinute: 9 * 60 + 30,
      status: AppointmentStatus.SUPERSEDED,
      statusReason: "O altă cerere suprapusă a pacientului a fost confirmată.",
      statusReasonCode: "OVERLAPPING_REQUEST_CONFIRMED",
      changedBy: "SYSTEM",
    },
    {
      key: "expired",
      treatment: "consultatie",
      startMinute: 14 * 60,
      status: AppointmentStatus.EXPIRED,
      statusReason: "Cererea nu a fost confirmată înainte de ora programării.",
      statusReasonCode: "REQUEST_EXPIRED",
      changedBy: "SYSTEM",
    },
  ];

  const selectedAppointments = appointmentDefinitions.filter(
    (definition) => options.scenario === "full" ||
      !["confirmed-overdue", "completed-awaiting-patient"].includes(definition.key),
  );
  const scenarioSlots = slotDefinitions.filter(
    (definition) => options.scenario === "full" ||
      !["confirmed-overdue", "completed-awaiting-patient"].includes(definition.key),
  );
  const allDemoRouteSlugs = appointmentDefinitions.map((definition) =>
    demoId("appointment", definition.key),
  );
  const allDemoSlotIds = demoSlotKeys.map((key) => demoId("slot", key));
  const existingIntervals = studentUser.studentProfile
    ? await prisma.studentAvailabilitySlot.findMany({
        where: {
          studentProfileId: studentUser.studentProfile.id,
          id: { notIn: allDemoSlotIds },
          status: StudentAvailabilitySlotStatus.ACTIVE,
        },
        select: { startsAt: true, endsAt: true },
      })
    : [];
  const selectedSlots = placeLocalDemoSlots(scenarioSlots, today, existingIntervals);

  async function validateExistingCalendar(
    client: Pick<Prisma.TransactionClient, "appointment" | "studentAvailabilitySlot">,
  ) {
    const otherPairAppointments = await client.appointment.count({
      where: {
        routeSlug: { in: allDemoRouteSlugs },
        OR: [
          { patientProfile: { userId: { not: patientUser.id } } },
          { studentProfile: { userId: { not: studentUser.id } } },
        ],
      },
    });
    if (otherPairAppointments > 0) {
      throw new Error("The existing demo data belongs to a different pair of accounts. Select the original pair or use a separate local database.");
    }

    // Do not move a fixture interval if an appointment created through the UI uses it.
    const dependentAppointments = await client.appointment.count({
      where: {
        studentAvailabilitySlotId: { in: allDemoSlotIds },
        routeSlug: { notIn: allDemoRouteSlugs },
      },
    });
    if (dependentAppointments > 0) {
      throw new Error(
        "Demo slots contain manually created appointments. The demo seed preserves those appointments. Use a separate local database for a new set of scenarios.",
      );
    }

    if (studentUser.studentProfile) {
      const conflicts = await client.studentAvailabilitySlot.count({
        where: {
          studentProfileId: studentUser.studentProfile.id,
          id: { notIn: allDemoSlotIds },
          status: StudentAvailabilitySlotStatus.ACTIVE,
          OR: selectedSlots.filter((slot) => !slot.isCancelled).map((slot) => ({
            startsAt: { lt: requiredInstant(addLocalDays(today, slot.dayOffset), slot.endMinute) },
            endsAt: { gt: requiredInstant(addLocalDays(today, slot.dayOffset), slot.startMinute) },
          })),
        },
      });
      if (conflicts > 0) {
        throw new Error("Existing availability overlaps the demo slots. The demo seed stopped without making changes.");
      }
    }
  }

  await validateExistingCalendar(prisma);
  await validateDemoDirectory(prisma, directory);

  console.log(`Scenario: ${options.scenario}. Profile refresh status: ${options.refresh}.`);
  console.log(`${selectedAppointments.length} demo appointments and ${selectedSlots.length} demo slots relative to ${today}.`);
  printDirectorySummary(directory);
  if (options.dryRun) {
    console.log("Dry run complete. No changes were written. Seeding preserves existing accounts, passwords, and photos.");
    console.log("Seeding configures the demo profiles and resources and resets this demo set's appointments, reviews, and notifications.");
    return;
  }

  const result = await prisma.$transaction(
    async (transaction) => {
      await validateExistingCalendar(transaction);
      const existingDirectory = await validateDemoDirectory(transaction, directory);
      const patientProfile = await transaction.patientProfile.upsert({
        where: { userId: patientUser.id },
        update: {
          dateOfBirth: effectiveBirthDate,
          bio:
            patientUser.patientProfile?.bio ??
            "Îmi doresc explicații clare despre opțiunile de tratament și pașii următori.",
        },
        create: {
          userId: patientUser.id,
          profileSlug: `pacient-demo-${patientUser.id.slice(0, 8).toLowerCase()}`,
          dateOfBirth: effectiveBirthDate,
          bio: "Îmi doresc explicații clare despre opțiunile de tratament și pașii următori.",
        },
      });
      const studentProfile = await transaction.studentProfile.upsert({
        where: { userId: studentUser.id },
        update: {
          publicSlug:
            studentUser.studentProfile?.publicSlug ??
            `student-demo-${studentUser.id.slice(0, 8).toLowerCase()}`,
          bio:
            studentUser.studentProfile?.bio ??
            "Student la medicină dentară, atent la confortul pacientului și la explicarea fiecărei etape.",
          isPublished: true,
          publishedAt: studentUser.studentProfile?.publishedAt ?? now,
          lastRefreshedAt,
        },
        create: {
          userId: studentUser.id,
          publicSlug: `student-demo-${studentUser.id.slice(0, 8).toLowerCase()}`,
          university: defaultUniversity.shortName,
          studyYear: 4,
          bio: "Student la medicină dentară, atent la confortul pacientului și la explicarea fiecărei etape.",
          isPublished: true,
          publishedAt: now,
          lastRefreshedAt,
        },
      });

      const treatmentCatalogBySlug = new Map(
        catalogTreatments.map((treatment) => [treatment.slug, treatment]),
      );
      const treatmentSpecs = [
        {
          key: "consultatie" as const,
          durationMinutes: 45,
          description: "Consultație generală și stabilirea planului orientativ de tratament.",
          deletedAt: null,
        },
        {
          key: "igienizare" as const,
          durationMinutes: 60,
          description: "Igienizare profesională realizată sub supraveghere.",
          deletedAt: null,
        },
        {
          key: "carii-si-obturatii" as const,
          durationMinutes: 90,
          description: "Tratamentul cariilor și refaceri coronare directe.",
          deletedAt: null,
        },
        {
          key: "tratament-de-canal" as const,
          durationMinutes: 120,
          description: "Resursă demonstrativă arhivată pentru tratamente endodontice.",
          deletedAt: now,
        },
      ];
      const studentTreatments = new Map<
        TreatmentKey,
        { id: string; durationMinutes: number; treatment: { name: string } }
      >();
      for (const spec of treatmentSpecs) {
        const catalogTreatment = treatmentCatalogBySlug.get(spec.key);
        if (!catalogTreatment) throw new Error(`Missing treatment ${spec.key}.`);
        const treatment = await transaction.studentTreatment.upsert({
          where: {
            studentProfileId_treatmentId: {
              studentProfileId: studentProfile.id,
              treatmentId: catalogTreatment.id,
            },
          },
          update: {
            description: spec.description,
            durationMinutes: spec.durationMinutes,
            deletedAt: spec.deletedAt,
          },
          create: {
            studentProfileId: studentProfile.id,
            treatmentId: catalogTreatment.id,
            description: spec.description,
            durationMinutes: spec.durationMinutes,
            deletedAt: spec.deletedAt,
          },
          include: { treatment: { select: { name: true } } },
        });
        studentTreatments.set(spec.key, treatment);
      }

      const locations = new Map<
        LocationKey,
        { id: string; name: string; address: string }
      >();
      const locationSpecs = [
        {
          key: "clinic" as const,
          routeKey: "a1b2c3",
          name: "Clinica Universitară Centru",
          address: "Str. Clinicilor nr. 32, Cluj-Napoca",
          details: "Etajul 1, cabinetul demonstrativ 4.",
          deletedAt: null,
        },
        {
          key: "faculty" as const,
          routeKey: "d4e5f6",
          name: "Facultatea de Medicină Dentară",
          address: "Str. Moților nr. 32, Cluj-Napoca",
          details: "Ambulatoriul studențesc, intrarea din curtea interioară.",
          deletedAt: null,
        },
      ];
      for (const spec of locationSpecs) {
        const location = await transaction.studentLocation.upsert({
          where: {
            studentProfileId_routeKey: {
              studentProfileId: studentProfile.id,
              routeKey: spec.routeKey,
            },
          },
          update: {
            cityId: city.id,
            name: spec.name,
            address: spec.address,
            details: spec.details,
            deletedAt: spec.deletedAt,
          },
          create: {
            studentProfileId: studentProfile.id,
            cityId: city.id,
            routeKey: spec.routeKey,
            name: spec.name,
            address: spec.address,
            details: spec.details,
            deletedAt: spec.deletedAt,
          },
        });
        locations.set(spec.key, location);
      }
      await transaction.studentLocation.upsert({
        where: {
          studentProfileId_routeKey: {
            studentProfileId: studentProfile.id,
            routeKey: "abc123",
          },
        },
        update: {
          cityId: city.id,
          name: "Cabinet demonstrativ arhivat",
          address: "Str. Memorandumului nr. 10, Cluj-Napoca",
          details: "Locație păstrată pentru verificarea resurselor arhivate.",
          deletedAt: now,
        },
        create: {
          studentProfileId: studentProfile.id,
          cityId: city.id,
          routeKey: "abc123",
          name: "Cabinet demonstrativ arhivat",
          address: "Str. Memorandumului nr. 10, Cluj-Napoca",
          details: "Locație păstrată pentru verificarea resurselor arhivate.",
          deletedAt: now,
        },
      });

      const demoRouteSlugs = allDemoRouteSlugs;
      await transaction.appointmentNotification.deleteMany({
        where: { appointment: { routeSlug: { in: demoRouteSlugs } } },
      });
      await transaction.appointmentReview.deleteMany({
        where: { appointment: { routeSlug: { in: demoRouteSlugs } } },
      });
      await transaction.appointment.updateMany({
        where: { routeSlug: { in: demoRouteSlugs } },
        data: {
          status: AppointmentStatus.EXPIRED,
          statusReason: "Resetare tehnică a datelor demonstrative locale.",
          statusReasonCode: "DEMO_RESET",
          statusChangedAt: now,
          statusChangedByUserId: null,
          isLateCancellation: false,
          expiredAt: now,
        },
      });
      await transaction.studentAvailabilitySlot.updateMany({
        where: {
          studentProfileId: studentProfile.id,
          id: { in: allDemoSlotIds },
          status: StudentAvailabilitySlotStatus.ACTIVE,
        },
        data: {
          status: StudentAvailabilitySlotStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      const slots = new Map<
        DemoSlotKey,
        {
          id: string;
          startsAt: Date;
          endsAt: Date;
          location: { name: string; address: string };
        }
      >();
      const offerings = new Map<
        string,
        { id: string }
      >();
      for (const definition of selectedSlots) {
        const localDate = addLocalDays(today, definition.dayOffset);
        const startsAt = requiredInstant(localDate, definition.startMinute);
        const endsAt = requiredInstant(localDate, definition.endMinute);
        const location = locations.get(definition.location);
        if (!location) throw new Error(`Missing location ${definition.location}.`);
        const slot = await transaction.studentAvailabilitySlot.upsert({
          where: { id: demoId("slot", definition.key) },
          update: {
            studentProfileId: studentProfile.id,
            studentLocationId: location.id,
            seriesId: null,
            sequenceNumber: null,
            originalStartsAt: definition.isException
              ? minusMinutes(startsAt, 30)
              : startsAt,
            startsAt,
            endsAt,
            status: definition.isCancelled
              ? StudentAvailabilitySlotStatus.CANCELLED
              : StudentAvailabilitySlotStatus.ACTIVE,
            isException: definition.isException ?? false,
            sourceRevision: 0,
            version: 1,
            cancelledAt: definition.isCancelled ? now : null,
          },
          create: {
            id: demoId("slot", definition.key),
            studentProfileId: studentProfile.id,
            studentLocationId: location.id,
            seriesId: null,
            sequenceNumber: null,
            originalStartsAt: definition.isException
              ? minusMinutes(startsAt, 30)
              : startsAt,
            startsAt,
            endsAt,
            status: definition.isCancelled
              ? StudentAvailabilitySlotStatus.CANCELLED
              : StudentAvailabilitySlotStatus.ACTIVE,
            isException: definition.isException ?? false,
            sourceRevision: 0,
            version: 1,
            cancelledAt: definition.isCancelled ? now : null,
          },
        });
        slots.set(definition.key, { ...slot, location });

        for (const offeringDefinition of definition.treatments) {
          const studentTreatment = studentTreatments.get(
            offeringDefinition.treatment,
          );
          if (!studentTreatment) {
            throw new Error(`Missing association for slot ${definition.key}.`);
          }
          const offering = await transaction.studentAvailabilitySlotOffering.upsert({
            where: {
              id: demoId(
                "offering",
                `${definition.key}-${offeringDefinition.treatment}`,
              ),
            },
            update: {
              slotId: slot.id,
              studentProfileId: studentProfile.id,
              studentTreatmentId: studentTreatment.id,
              removedAt: null,
            },
            create: {
              id: demoId(
                "offering",
                `${definition.key}-${offeringDefinition.treatment}`,
              ),
              slotId: slot.id,
              studentProfileId: studentProfile.id,
              studentTreatmentId: studentTreatment.id,
              removedAt: null,
            },
          });
          offerings.set(`${definition.key}:${offeringDefinition.treatment}`, {
            id: offering.id,
          });
        }
      }

      const appointments = new Map<
        string,
        { id: string; scheduledEndsAt: Date }
      >();
      for (const definition of selectedAppointments) {
        const slot = slots.get(definition.key);
        const studentTreatment = studentTreatments.get(definition.treatment);
        const offering = offerings.get(
          `${definition.key}:${definition.treatment}`,
        );
        if (!slot || !studentTreatment || !offering) {
          throw new Error(`Missing slot or offering for ${definition.key}.`);
        }
        const slotDefinition = selectedSlots.find(
          (item) => item.key === definition.key,
        );
        if (!slotDefinition) {
          throw new Error(`Missing definition for slot ${definition.key}.`);
        }
        const localDate = addLocalDays(today, slotDefinition.dayOffset);
        const scheduledStartsAt = requiredInstant(
          localDate,
          definition.startMinute,
        );
        const scheduledEndsAt = plusMinutes(
          scheduledStartsAt,
          studentTreatment.durationMinutes,
        );
        const confirmedAt = definition.confirmed
          ? new Date(Math.min(minusMinutes(scheduledStartsAt, 24 * 60).getTime(), minusMinutes(now, 30).getTime()))
          : null;
        const decisionAt =
          definition.status === AppointmentStatus.PENDING
            ? minusMinutes(now, 30)
            : definition.status === AppointmentStatus.CONFIRMED &&
                scheduledEndsAt > now
              ? minusMinutes(now, 20)
              : definition.status === AppointmentStatus.CANCELLED_BY_PATIENT
                ? minusMinutes(
                    scheduledStartsAt,
                    definition.isLateCancellation ? 45 : 6 * 60,
                  )
                : definition.status === AppointmentStatus.CANCELLED_BY_STUDENT ||
                    definition.status === AppointmentStatus.REJECTED ||
                    definition.status === AppointmentStatus.SUPERSEDED
                  ? minusMinutes(scheduledStartsAt, 24 * 60)
                  : definition.status === AppointmentStatus.EXPIRED
                    ? scheduledStartsAt
                    : plusMinutes(scheduledEndsAt, 15);
        const statusChangedByUserId =
          definition.changedBy === "PATIENT"
            ? patientUser.id
            : definition.changedBy === "STUDENT"
              ? studentUser.id
              : null;
        const createdAt = definition.status === AppointmentStatus.PENDING
          ? minusMinutes(now, 30)
          : new Date(Math.min(
              minusMinutes(scheduledStartsAt, 2 * 24 * 60).getTime(),
              minusMinutes(now, 60).getTime(),
            ));
        const appointmentData = {
          createdAt,
          pendingExpiresAt: definition.status === AppointmentStatus.PENDING
            ? new Date(Math.min(scheduledStartsAt.getTime(), plusMinutes(createdAt, 24 * 60).getTime()))
            : null,
          patientProfileId: patientProfile.id,
          studentProfileId: studentProfile.id,
          studentAvailabilitySlotId: slot.id,
          studentAvailabilitySlotOfferingId: offering.id,
          scheduledStartsAt,
          scheduledEndsAt,
          patientAgeAtAppointment: ageOnDate(
            effectiveBirthDate,
            scheduledStartsAt,
          ),
          patientNote: definition.note ?? null,
          patientNameSnapshot: patientUser.name,
          studentNameSnapshot: studentUser.name,
          treatmentNameSnapshot: studentTreatment.treatment.name,
          locationNameSnapshot: slot.location.name,
          locationAddressSnapshot: slot.location.address,
          studentUniversitySnapshot: studentProfile.university,
          status: definition.status,
          version: 1,
          statusReason: definition.statusReason ?? null,
          statusReasonCode: definition.statusReasonCode ?? null,
          statusChangedAt: decisionAt,
          statusChangedByUserId,
          isLateCancellation: definition.isLateCancellation ?? false,
          confirmedAt,
          rejectedAt:
            definition.status === AppointmentStatus.REJECTED ? decisionAt : null,
          cancelledAt:
            definition.status === AppointmentStatus.CANCELLED_BY_PATIENT ||
            definition.status === AppointmentStatus.CANCELLED_BY_STUDENT
              ? decisionAt
              : null,
          expiredAt:
            definition.status === AppointmentStatus.EXPIRED ? decisionAt : null,
          completedAt:
            definition.status === AppointmentStatus.COMPLETED ? decisionAt : null,
          noShowAt:
            definition.status === AppointmentStatus.NO_SHOW ? decisionAt : null,
        };
        const appointment = await transaction.appointment.upsert({
          where: { routeSlug: demoId("appointment", definition.key) },
          update: appointmentData,
          create: {
            routeSlug: demoId("appointment", definition.key),
            ...appointmentData,
          },
        });
        appointments.set(definition.key, appointment);
      }

      const appointmentIds = [...appointments.values()].map(
        (appointment) => appointment.id,
      );
      await transaction.appointmentReview.deleteMany({
        where: { appointmentId: { in: appointmentIds } },
      });
      const publishedReviewSpecs = [
        {
          appointment: "completed-awaiting-patient",
          authorRole: AppointmentReviewAuthorRole.STUDENT,
          rating: 5,
          comment: "Pacient punctual, cooperant și atent la recomandările primite.",
          published: false,
        },
        {
          appointment: "completed-reviewed",
          authorRole: AppointmentReviewAuthorRole.STUDENT,
          rating: 4,
          comment: "Comunicare bună și colaborare foarte ușoară pe durata tratamentului.",
          published: true,
        },
        {
          appointment: "completed-reviewed",
          authorRole: AppointmentReviewAuthorRole.PATIENT,
          rating: 5,
          comment: "Mi-a explicat clar fiecare etapă și m-am simțit în siguranță.",
          published: true,
        },
        {
          appointment: "completed-reviewed-second",
          authorRole: AppointmentReviewAuthorRole.STUDENT,
          rating: 5,
          comment: null,
          published: true,
        },
        {
          appointment: "completed-reviewed-second",
          authorRole: AppointmentReviewAuthorRole.PATIENT,
          rating: 4,
          comment: "Consultația a fost atentă, iar recomandările au fost ușor de urmărit.",
          published: true,
        },
        {
          appointment: "no-show-reviewed",
          authorRole: AppointmentReviewAuthorRole.STUDENT,
          rating: 2,
          comment: "Pacientul nu s-a prezentat și nu a anunțat înainte de programare.",
          published: true,
        },
      ] as const;
      for (const reviewSpec of publishedReviewSpecs) {
        if (options.scenario === "booking" && reviewSpec.appointment === "completed-awaiting-patient") continue;
        const appointment = appointments.get(reviewSpec.appointment);
        if (!appointment) {
          throw new Error(`Missing appointment ${reviewSpec.appointment}.`);
        }
        const isPatient =
          reviewSpec.authorRole === AppointmentReviewAuthorRole.PATIENT;
        const submittedAt = plusMinutes(
          appointment.scheduledEndsAt,
          isPatient ? 45 : 15,
        );
        await transaction.appointmentReview.create({
          data: {
            appointmentId: appointment.id,
            authorUserId: isPatient ? patientUser.id : studentUser.id,
            targetUserId: isPatient ? studentUser.id : patientUser.id,
            authorRole: reviewSpec.authorRole,
            rating: reviewSpec.rating,
            comment: reviewSpec.comment,
            submittedAt,
            publishedAt: reviewSpec.published
              ? plusMinutes(appointment.scheduledEndsAt, 75)
              : null,
          },
        });
      }

      const notificationSpecs = [
        {
          appointment: "pending",
          recipientUserId: studentUser.id,
          eventType: "DEMO_REQUEST_CREATED",
        },
        {
          appointment: "cancelled-patient-late",
          recipientUserId: studentUser.id,
          eventType: "DEMO_PATIENT_CANCELLED",
        },
        {
          appointment: "superseded",
          recipientUserId: studentUser.id,
          eventType: "DEMO_REQUEST_SUPERSEDED",
        },
        {
          appointment: "confirmed-future",
          recipientUserId: patientUser.id,
          eventType: "DEMO_REQUEST_CONFIRMED",
        },
        {
          appointment: "cancelled-student",
          recipientUserId: patientUser.id,
          eventType: "DEMO_STUDENT_CANCELLED",
        },
        {
          appointment: "rejected",
          recipientUserId: patientUser.id,
          eventType: "DEMO_REQUEST_REJECTED",
        },
      ];
      for (const [index, notificationSpec] of notificationSpecs.entries()) {
        const appointment = appointments.get(notificationSpec.appointment);
        if (!appointment) {
          throw new Error(`Missing appointment ${notificationSpec.appointment}.`);
        }
        await transaction.appointmentNotification.create({
          data: {
            id: demoId("notification", String(index + 1)),
            appointmentId: appointment.id,
            recipientUserId: notificationSpec.recipientUserId,
            eventType: notificationSpec.eventType,
            createdAt: minusMinutes(now, (index + 1) * 4),
          },
        });
      }

      await writeDemoDirectory(transaction, directory, existingDirectory, now);

      return {
        patientName: patientUser.name,
        studentName: studentUser.name,
        appointmentCount: appointments.size,
        activeLocationCount: locations.size,
        activeTreatmentCount: treatmentSpecs.filter((item) => !item.deletedAt)
          .length,
        activeCalendarCount: selectedSlots.filter((item) => !item.isCancelled)
          .length,
        hiddenCancelledCalendarCount: selectedSlots.filter(
          (item) => item.isCancelled,
        ).length,
        unreadPatientNotifications: notificationSpecs.filter(
          (item) => item.recipientUserId === patientUser.id,
        ).length,
        unreadStudentNotifications: notificationSpecs.filter(
          (item) => item.recipientUserId === studentUser.id,
        ).length,
      };
    },
    { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 },
  );

  console.log(
    `Demo data was seeded for patient "${result.patientName}" and student "${result.studentName}".`,
  );
  console.log(
    `Appointments: ${result.appointmentCount}. Visible calendar occurrences: ${result.activeCalendarCount}. Hidden cancelled occurrences: ${result.hiddenCancelledCalendarCount}.`,
  );
  console.log(
    `${result.activeTreatmentCount} active treatments and ${result.activeLocationCount} active locations, plus one archived resource of each type.`,
  );
  console.log(
    `Unread notifications: ${result.unreadPatientNotifications} for the patient and ${result.unreadStudentNotifications} for the student.`,
  );
  console.log(`${directory.profiles.length} demo profiles and ${directory.slots.length} slots are ready for the home page and search. Fictional accounts have no passwords and receive no email.`);
  console.log(options.scenario === "full"
    ? "The full scenario includes an overdue appointment and an outstanding review. Resolve both in the app before testing new requests and confirmations."
    : "The booking scenario lets you test a new request immediately, with no overdue appointments or outstanding reviews added.");
  console.log("Directory: /studenti?tratament=consultatie&oras=cluj-napoca. See scripts/DEMO-TESTING.md for testing instructions.");
}

main()
  .catch((error: unknown) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
