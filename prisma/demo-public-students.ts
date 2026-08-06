import "dotenv/config";

import type { Prisma } from "../src/generated/prisma/client";
import { UserRole } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

const DEMO_COUNT = 36;
const DENSE_RESULT_COUNT = 20;
const DEMO_EMAIL_SUFFIX = "@demo.universident.invalid";
const DEMO_USER_PREFIX = "demo_public_student_user_";
const DEMO_PROFILE_PREFIX = "demo_public_student_profile_";
const DEMO_RESOURCE_PREFIX = "demo_public_student_";
const DEMO_SLUG_PREFIX = "demo-student-";
const LOCAL_DATABASE_NAME = "universident";
const LOCAL_DATABASE_PORT = "5432";
const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

type DemoOperation = "seed" | "cleanup";

type CatalogOption = {
  id: string;
  name: string;
  slug: string;
};

type DemoData = {
  users: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    image: null;
  }[];
  profiles: {
    id: string;
    userId: string;
    publicSlug: string;
    university: string;
    studyYear: number;
    bio: string | null;
    isPublished: boolean;
    publishedAt: Date;
  }[];
  supervisors: {
    id: string;
    studentProfileId: string;
    fullName: string;
    academicTitle: string | null;
    isActive: boolean;
    deletedAt: null;
  }[];
  locations: {
    id: string;
    studentProfileId: string;
    cityId: string;
    routeKey: string;
    name: string;
    address: string;
    details: string | null;
    isActive: boolean;
    deletedAt: null;
  }[];
  treatments: {
    id: string;
    studentProfileId: string;
    treatmentId: string;
    description: string | null;
    durationMinutes: number;
    isActive: boolean;
    deletedAt: null;
  }[];
  assignments: {
    id: string;
    studentProfileId: string;
    studentTreatmentId: string;
    studentLocationId: string;
    supervisorId: string;
    isActive: boolean;
    deletedAt: null;
  }[];
};

const studentNames = [
  "Ana Pop",
  "Mihai Radu",
  "Ioana Dima",
  "Radu Stan",
  "Elena Matei",
  "Victor Ene",
  "Daria Munteanu",
  "Paul Ilie",
  "Sofia Neagu",
  "Tudor Marin",
  "Maria Luca",
  "Andrei Cristea",
  "Ilinca Pavel",
  "Rareș Dobre",
  "Teodora Nistor",
  "Alexandru Constantin Ionescu-Dumitrescu",
  "Anastasia Maria Popescu-Vasilescu",
  "Ștefan Alexandru Petrescu",
  "Cătălina Georgiana Dumitru",
  "Vlad Sebastian Georgescu",
  "Bianca Tudor",
  "Cezar Roman",
  "Diana Oprea",
  "Filip Enache",
  "Georgiana Sava",
  "Horia Preda",
  "Iulia Zamfir",
  "Karina Mocanu",
  "Liviu Barbu",
  "Mara Șerban",
  "Nicolas Avram",
  "Oana Toma",
  "Petru Lupu",
  "Roxana Drăgan",
  "Sabina Coman",
  "Vasile Mircea Alexandru Popovici",
] as const;

const universities = [
  "Universitatea de Medicină și Farmacie Cluj-Napoca",
  "Universitatea de Medicină și Farmacie Carol Davila",
  "Universitatea de Medicină și Farmacie Grigore T. Popa",
  "Universitatea de Medicină și Farmacie Victor Babeș",
  "Universitatea de Medicină, Farmacie, Științe și Tehnologie",
] as const;

const supervisorNames = [
  "Adriana Ionescu",
  "Bogdan Marinescu",
  "Carmen Dumitrescu",
  "Dan Constantin Alexandrescu",
  "Elisa Popa",
  "Florin Șerban",
  "Gabriela Andrei",
  "Horațiu Petrescu-Vasilescu",
] as const;

const academicTitles = [
  null,
  "Dr.",
  "Prof. univ. dr.",
  "Conf. univ. dr.",
  "Șef lucr. dr.",
] as const;

function readOperation(): DemoOperation {
  const operation = process.argv[2];
  if (operation === "seed" || operation === "cleanup") return operation;

  throw new Error(
    "Operație invalidă. Folosește `seed` sau `cleanup`.",
  );
}

function assertSafeLocalDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Scriptul demo refuză execuția în production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nu este configurat.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nu este un URL PostgreSQL valid.");
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  const port = parsedUrl.port || LOCAL_DATABASE_PORT;
  const isPostgreSql = ["postgres:", "postgresql:"].includes(
    parsedUrl.protocol,
  );

  if (
    !isPostgreSql ||
    !LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname.toLowerCase()) ||
    port !== LOCAL_DATABASE_PORT ||
    databaseName !== LOCAL_DATABASE_NAME
  ) {
    throw new Error(
      "Scriptul demo poate rula numai pe baza PostgreSQL locală Universident.",
    );
  }
}

function demoNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function demoBio(index: number) {
  if (index % 4 === 0) return null;
  if (index % 4 === 1) {
    return "Student interesat de prevenție și comunicare clară cu pacienții.";
  }
  if (index % 4 === 2) {
    return "Îmi dezvolt experiența clinică prin tratamente realizate atent, sub îndrumarea profesorilor supervizori, cu accent pe confortul pacientului.";
  }

  return "Sunt student la medicină dentară și urmăresc să explic fiecare etapă într-un limbaj accesibil. Mă interesează prevenția, tratamentele restaurative și o experiență calmă pentru pacient, iar activitatea clinică se desfășoară întotdeauna sub supravegherea profesorului asociat fiecărei locații.";
}

function routeKey(studentIndex: number, locationIndex: number) {
  return (studentIndex * 8 + locationIndex + 1)
    .toString(16)
    .padStart(6, "0");
}

function buildDemoData(
  treatments: CatalogOption[],
  cities: CatalogOption[],
  publishedAt: Date,
): {
  data: DemoData;
  denseTreatment: CatalogOption;
  denseCity: CatalogOption;
} {
  const denseTreatment =
    treatments.find((treatment) => treatment.slug === "igienizare") ??
    treatments[0];
  const denseCity =
    cities.find((city) => city.slug === "cluj-napoca") ?? cities[0];

  if (!denseTreatment || !denseCity) {
    throw new Error("Catalogul activ nu conține tratamente și orașe.");
  }

  const alternateTreatments = treatments.filter(
    (treatment) => treatment.id !== denseTreatment.id,
  );
  const alternateCities = cities.filter((city) => city.id !== denseCity.id);

  if (alternateTreatments.length === 0 || alternateCities.length === 0) {
    throw new Error(
      "Sunt necesare minimum două tratamente și două orașe active pentru varietatea demo.",
    );
  }

  const data: DemoData = {
    users: [],
    profiles: [],
    supervisors: [],
    locations: [],
    treatments: [],
    assignments: [],
  };

  for (let index = 0; index < DEMO_COUNT; index += 1) {
    const number = demoNumber(index);
    const userId = `${DEMO_USER_PREFIX}${number}`;
    const profileId = `${DEMO_PROFILE_PREFIX}${number}`;
    const primaryTreatment =
      index < DENSE_RESULT_COUNT
        ? denseTreatment
        : alternateTreatments[index % alternateTreatments.length];
    const primaryCity =
      index < DENSE_RESULT_COUNT
        ? denseCity
        : alternateCities[index % alternateCities.length];

    data.users.push({
      id: userId,
      name: studentNames[index],
      email: `student-${number}${DEMO_EMAIL_SUFFIX}`,
      emailVerified: true,
      role: UserRole.STUDENT,
      image: null,
    });
    data.profiles.push({
      id: profileId,
      userId,
      publicSlug: `${DEMO_SLUG_PREFIX}${number}`,
      university: universities[index % universities.length],
      studyYear: (index % 6) + 1,
      bio: demoBio(index),
      isPublished: true,
      publishedAt,
    });

    const supervisorCount = index % 5 === 0 ? 2 : 1;
    const studentSupervisorIds: string[] = [];
    for (
      let supervisorIndex = 0;
      supervisorIndex < supervisorCount;
      supervisorIndex += 1
    ) {
      const supervisorId = `${DEMO_RESOURCE_PREFIX}supervisor_${number}_${supervisorIndex + 1}`;
      studentSupervisorIds.push(supervisorId);
      data.supervisors.push({
        id: supervisorId,
        studentProfileId: profileId,
        fullName:
          supervisorNames[(index + supervisorIndex) % supervisorNames.length],
        academicTitle:
          academicTitles[(index + supervisorIndex) % academicTitles.length],
        isActive: true,
        deletedAt: null,
      });
    }

    const locationCount = index % 4 === 0 ? 2 : 1;
    const studentLocations: { id: string; city: CatalogOption }[] = [];
    for (
      let locationIndex = 0;
      locationIndex < locationCount;
      locationIndex += 1
    ) {
      const locationId = `${DEMO_RESOURCE_PREFIX}location_${number}_${locationIndex + 1}`;
      const city =
        locationIndex === 0
          ? primaryCity
          : index < DENSE_RESULT_COUNT
            ? denseCity
          : alternateCities[
              (index + locationIndex) % alternateCities.length
            ];
      studentLocations.push({ id: locationId, city });
      data.locations.push({
        id: locationId,
        studentProfileId: profileId,
        cityId: city.id,
        routeKey: routeKey(index, locationIndex),
        name:
          locationIndex === 0
            ? `Clinica demo ${number}`
            : `Centrul universitar demo ${number}`,
        address: `Strada Exemplu ${index + 10}, numărul ${locationIndex + 1}`,
        details:
          locationIndex === 0
            ? null
            : "Acces pe baza unei programări stabilite în afara platformei.",
        isActive: true,
        deletedAt: null,
      });
    }

    const selectedTreatments = [primaryTreatment];
    if (index % 3 === 0) {
      const secondaryTreatment = alternateTreatments.find(
        (treatment) => treatment.id !== primaryTreatment.id,
      );
      if (secondaryTreatment) selectedTreatments.push(secondaryTreatment);
    }

    selectedTreatments.forEach((treatment, treatmentIndex) => {
      const studentTreatmentId = `${DEMO_RESOURCE_PREFIX}treatment_${number}_${treatmentIndex + 1}`;
      data.treatments.push({
        id: studentTreatmentId,
        studentProfileId: profileId,
        treatmentId: treatment.id,
        description:
          index % 4 === 0
            ? null
            : `Tratament demo oferit sub supervizare, adaptat etapelor clinice recomandate pentru ${treatment.name.toLocaleLowerCase("ro-RO")}.`,
        durationMinutes: 30 + (index % 7) * 15,
        isActive: true,
        deletedAt: null,
      });

      studentLocations.forEach((location, locationIndex) => {
        data.assignments.push({
          id: `${DEMO_RESOURCE_PREFIX}assignment_${number}_${treatmentIndex + 1}_${locationIndex + 1}`,
          studentProfileId: profileId,
          studentTreatmentId,
          studentLocationId: location.id,
          supervisorId:
            studentSupervisorIds[
              (treatmentIndex + locationIndex) % studentSupervisorIds.length
            ],
          isActive: true,
          deletedAt: null,
        });
      });
    });
  }

  return { data, denseTreatment, denseCity };
}

async function assertDemoNamespaceIsSafe(
  transaction: Prisma.TransactionClient,
) {
  const users = await transaction.user.findMany({
    where: {
      OR: [
        { id: { startsWith: DEMO_USER_PREFIX } },
        { email: { endsWith: DEMO_EMAIL_SUFFIX } },
      ],
    },
    select: {
      id: true,
      email: true,
      studentProfile: { select: { publicSlug: true } },
    },
  });

  const unsafeUser = users.find(
    (user) =>
      !user.id.startsWith(DEMO_USER_PREFIX) ||
      !user.email.endsWith(DEMO_EMAIL_SUFFIX) ||
      (user.studentProfile?.publicSlug !== null &&
        !user.studentProfile?.publicSlug?.startsWith(DEMO_SLUG_PREFIX)),
  );
  if (unsafeUser) {
    throw new Error(
      "Namespace-ul demo se suprapune peste date care nu au identificarea completă a fixture-ului.",
    );
  }

  const reservedSlugProfiles = await transaction.studentProfile.findMany({
    where: {
      publicSlug: { startsWith: DEMO_SLUG_PREFIX },
    },
    select: { user: { select: { id: true, email: true } } },
  });
  const foreignDemoSlug = reservedSlugProfiles.some(
    (profile) =>
      !profile.user.id.startsWith(DEMO_USER_PREFIX) ||
      !profile.user.email.endsWith(DEMO_EMAIL_SUFFIX),
  );
  if (foreignDemoSlug) {
    throw new Error(
      "Un slug rezervat datelor demo este folosit de un profil din afara fixture-ului.",
    );
  }

  const demoUserIds = users.map((user) => user.id);
  if (demoUserIds.length === 0) return;

  const [accounts, sessions] = await Promise.all([
    transaction.account.count({ where: { userId: { in: demoUserIds } } }),
    transaction.session.count({ where: { userId: { in: demoUserIds } } }),
  ]);
  if (accounts > 0 || sessions > 0) {
    throw new Error(
      "Operația a fost oprită deoarece identitățile demo au conturi sau sesiuni asociate.",
    );
  }
}

async function nonDemoCounts(
  transaction: Prisma.TransactionClient,
) {
  const nonDemoStudentProfile = {
    user: { email: { not: { endsWith: DEMO_EMAIL_SUFFIX } } },
  } as const;

  const [
    users,
    profiles,
    supervisors,
    locations,
    treatments,
    assignments,
    accounts,
    sessions,
    catalogTreatments,
    catalogCities,
  ] = await Promise.all([
    transaction.user.count({
      where: { email: { not: { endsWith: DEMO_EMAIL_SUFFIX } } },
    }),
    transaction.studentProfile.count({
      where: { user: { email: { not: { endsWith: DEMO_EMAIL_SUFFIX } } } },
    }),
    transaction.studentSupervisor.count({
      where: { studentProfile: nonDemoStudentProfile },
    }),
    transaction.studentLocation.count({
      where: { studentProfile: nonDemoStudentProfile },
    }),
    transaction.studentTreatment.count({
      where: { studentProfile: nonDemoStudentProfile },
    }),
    transaction.studentTreatmentLocation.count({
      where: {
        studentTreatment: { studentProfile: nonDemoStudentProfile },
      },
    }),
    transaction.account.count({
      where: { user: { email: { not: { endsWith: DEMO_EMAIL_SUFFIX } } } },
    }),
    transaction.session.count({
      where: { user: { email: { not: { endsWith: DEMO_EMAIL_SUFFIX } } } },
    }),
    transaction.treatment.count(),
    transaction.city.count(),
  ]);

  return {
    users,
    profiles,
    supervisors,
    locations,
    treatments,
    assignments,
    accounts,
    sessions,
    catalogTreatments,
    catalogCities,
  };
}

async function deleteDemoData(
  transaction: Prisma.TransactionClient,
) {
  const demoUsers = await transaction.user.findMany({
    where: {
      id: { startsWith: DEMO_USER_PREFIX },
      email: { endsWith: DEMO_EMAIL_SUFFIX },
    },
    select: {
      id: true,
      studentProfile: { select: { id: true } },
    },
  });
  const demoUserIds = demoUsers.map((user) => user.id);
  const demoProfileIds = demoUsers.flatMap((user) =>
    user.studentProfile ? [user.studentProfile.id] : [],
  );

  if (demoUserIds.length === 0) {
    return {
      users: 0,
      profiles: 0,
      supervisors: 0,
      locations: 0,
      treatments: 0,
      assignments: 0,
    };
  }

  const assignments = await transaction.studentTreatmentLocation.deleteMany({
    where: { studentProfileId: { in: demoProfileIds } },
  });
  const treatments = await transaction.studentTreatment.deleteMany({
    where: { studentProfileId: { in: demoProfileIds } },
  });
  const locations = await transaction.studentLocation.deleteMany({
    where: { studentProfileId: { in: demoProfileIds } },
  });
  const supervisors = await transaction.studentSupervisor.deleteMany({
    where: { studentProfileId: { in: demoProfileIds } },
  });
  const profiles = await transaction.studentProfile.deleteMany({
    where: { id: { in: demoProfileIds } },
  });
  const users = await transaction.user.deleteMany({
    where: { id: { in: demoUserIds } },
  });

  return {
    users: users.count,
    profiles: profiles.count,
    supervisors: supervisors.count,
    locations: locations.count,
    treatments: treatments.count,
    assignments: assignments.count,
  };
}

async function seedDemoStudents() {
  const result = await prisma.$transaction(
    async (transaction) => {
      await assertDemoNamespaceIsSafe(transaction);
      const before = await nonDemoCounts(transaction);
      await deleteDemoData(transaction);

      const [treatments, cities] = await Promise.all([
        transaction.treatment.findMany({
          where: { isActive: true },
          orderBy: { slug: "asc" },
          select: { id: true, name: true, slug: true },
        }),
        transaction.city.findMany({
          where: { isActive: true },
          orderBy: { slug: "asc" },
          select: { id: true, name: true, slug: true },
        }),
      ]);
      const { data, denseTreatment, denseCity } = buildDemoData(
        treatments,
        cities,
        new Date(),
      );

      await transaction.user.createMany({ data: data.users });
      await transaction.studentProfile.createMany({ data: data.profiles });
      await transaction.studentSupervisor.createMany({
        data: data.supervisors,
      });
      await transaction.studentLocation.createMany({ data: data.locations });
      await transaction.studentTreatment.createMany({
        data: data.treatments,
      });
      await transaction.studentTreatmentLocation.createMany({
        data: data.assignments,
      });

      const demoUserIds = data.users.map((user) => user.id);
      const [accounts, sessions, denseProfiles] = await Promise.all([
        transaction.account.count({ where: { userId: { in: demoUserIds } } }),
        transaction.session.count({ where: { userId: { in: demoUserIds } } }),
        transaction.studentProfile.count({
          where: {
            userId: { in: demoUserIds },
            studentTreatments: {
              some: {
                treatmentId: denseTreatment.id,
                treatmentLocations: {
                  some: {
                    studentLocation: { cityId: denseCity.id },
                  },
                },
              },
            },
          },
        }),
      ]);
      const after = await nonDemoCounts(transaction);

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error(
          "Verificarea de integritate a detectat modificări în afara namespace-ului demo.",
        );
      }
      if (accounts !== 0 || sessions !== 0) {
        throw new Error("Fixture-ul demo nu poate conține conturi sau sesiuni.");
      }
      if (denseProfiles < 15) {
        throw new Error(
          "Fixture-ul nu produce suficiente rezultate pentru testarea paginării.",
        );
      }

      return {
        profiles: data.profiles.length,
        treatments: data.treatments.length,
        locations: data.locations.length,
        supervisors: data.supervisors.length,
        assignments: data.assignments.length,
        denseProfiles,
        denseTreatment,
        denseCity,
      };
    },
    { isolationLevel: "Serializable" },
  );

  const query = new URLSearchParams({
    tratament: result.denseTreatment.slug,
    oras: result.denseCity.slug,
  });

  console.log("Datele demo au fost create sau actualizate tranzacțional.");
  console.log(`Profiluri demo: ${result.profiles}`);
  console.log(`Tratamente demo: ${result.treatments}`);
  console.log(`Locații demo: ${result.locations}`);
  console.log(`Supervizori demo: ${result.supervisors}`);
  console.log(`Asocieri demo: ${result.assignments}`);
  console.log(
    `Filtru dens: ${result.denseTreatment.name} în ${result.denseCity.name} (${result.denseProfiles} profiluri)`,
  );
  console.log(`URL test: http://localhost:3000/studenti?${query.toString()}`);
  console.log("Datele existente din afara namespace-ului demo sunt neschimbate.");
  console.log("Conturi Better Auth demo: 0; sesiuni demo: 0; parole demo: 0.");
}

async function cleanupDemoStudents() {
  const deleted = await prisma.$transaction(
    async (transaction) => {
      await assertDemoNamespaceIsSafe(transaction);
      const before = await nonDemoCounts(transaction);
      const cleanup = await deleteDemoData(transaction);
      const after = await nonDemoCounts(transaction);

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error(
          "Verificarea de integritate a detectat modificări în afara namespace-ului demo.",
        );
      }

      return cleanup;
    },
    { isolationLevel: "Serializable" },
  );

  console.log("Au fost șterse exclusiv datele demo Universident.");
  console.log(`Profiluri demo șterse: ${deleted.profiles}`);
  console.log(`Tratamente demo șterse: ${deleted.treatments}`);
  console.log(`Locații demo șterse: ${deleted.locations}`);
  console.log(`Supervizori demo șterși: ${deleted.supervisors}`);
  console.log(`Asocieri demo șterse: ${deleted.assignments}`);
  console.log(`Utilizatori demo șterși: ${deleted.users}`);
}

async function main() {
  assertSafeLocalDatabase();
  const operation = readOperation();

  if (operation === "seed") {
    await seedDemoStudents();
  } else {
    await cleanupDemoStudents();
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Eroare necunoscută.";
    console.error(`Scriptul demo a eșuat: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
