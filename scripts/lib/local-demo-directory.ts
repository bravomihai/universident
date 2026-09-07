import type { Prisma } from "../../src/generated/prisma/client";
import { addLocalDays, localDateForInstant, utcInstantForBucharestLocal } from "../../src/lib/availability/bucharest-time";

const BASE_DIRECTORY_COUNT = 100;
const CLUJ_GINGIVAL_COUNT = 40;
export const DEMO_DIRECTORY_COUNT = BASE_DIRECTORY_COUNT + CLUJ_GINGIVAL_COUNT;

// Deliberately uneven: common searches have several pages, smaller cities have fewer results.
export const demoDirectoryCities = [
  { slug: "cluj-napoca", count: 20 },
  { slug: "bucuresti", count: 20 },
  { slug: "iasi", count: 12 },
  { slug: "timisoara", count: 12 },
  { slug: "targu-mures", count: 6 },
  { slug: "constanta", count: 5 },
  { slug: "craiova", count: 5 },
  { slug: "oradea", count: 5 },
  { slug: "sibiu", count: 5 },
  { slug: "arad", count: 5 },
  { slug: "galati", count: 5 },
] as const;

export const demoDirectoryTreatments = [
  { slug: "consultatie", durationMinutes: 45 },
  { slug: "igienizare", durationMinutes: 60 },
  { slug: "carii-si-obturatii", durationMinutes: 90 },
  { slug: "tratament-de-canal", durationMinutes: 120 },
  { slug: "afectiuni-gingivale", durationMinutes: 60 },
  { slug: "protetica-dentara", durationMinutes: 90 },
  { slug: "stomatologie-pediatrica", durationMinutes: 45 },
  { slug: "chirurgie-dento-alveolara", durationMinutes: 90 },
  { slug: "ortodontie", durationMinutes: 60 },
] as const;

type DirectoryCatalog = {
  cities: { id: string; slug: string; name: string }[];
  treatments: { id: string; slug: string; name: string }[];
  universities: { shortName: string; city: string }[];
};

export type DemoDirectoryPlan = {
  users: Prisma.UserCreateManyInput[];
  profiles: Prisma.StudentProfileCreateManyInput[];
  locations: Prisma.StudentLocationCreateManyInput[];
  supervisors: Prisma.StudentSupervisorCreateManyInput[];
  treatments: Prisma.StudentTreatmentCreateManyInput[];
  slots: Prisma.StudentAvailabilitySlotCreateManyInput[];
  offerings: Prisma.StudentAvailabilitySlotOfferingCreateManyInput[];
  coverage: { city: string; treatment: string; profiles: number }[];
};

function directoryIdentity(index: number) {
  const number = String(index + 1).padStart(3, "0");
  return {
    id: `demo-ui-directory-${number}-user`,
    email: `student.${number}@demo.universident.test`,
    profileId: `demo-ui-directory-${number}-profile`,
    publicSlug: `student-demo-${number}`,
    prefix: `demo-ui-directory-${number}`,
  };
}

const directoryIdentities = Array.from({ length: DEMO_DIRECTORY_COUNT }, (_, index) => directoryIdentity(index));

// Exclude only exact fixture identities from selection of the original scenario student.
export function isDemoDirectoryStudent(user: {
  id: string; email: string; role: string;
  studentProfile: { id: string; publicSlug: string | null } | null;
}) {
  return user.role === "STUDENT" && directoryIdentities.some((identity) =>
    user.id === identity.id && user.email === identity.email &&
    user.studentProfile?.id === identity.profileId &&
    user.studentProfile.publicSlug === identity.publicSlug,
  );
}

export function buildDemoDirectory(catalog: DirectoryCatalog, now: Date): DemoDirectoryPlan {
  const cities = demoDirectoryCities.map((spec) => {
    const city = catalog.cities.find((candidate) => candidate.slug === spec.slug);
    if (!city || !catalog.universities.some((university) => university.city === city.name)) {
      throw new Error(`Lipsește orașul sau universitatea activă pentru ${spec.slug}. Rulează npm run db:seed.`);
    }
    return { ...city, count: spec.count };
  });
  const treatments = demoDirectoryTreatments.map((spec) => {
    const treatment = catalog.treatments.find((candidate) => candidate.slug === spec.slug);
    if (!treatment) throw new Error(`Lipsește tratamentul activ ${spec.slug}. Rulează npm run db:seed.`);
    return { ...treatment, durationMinutes: spec.durationMinutes };
  });
  const homeCities = cities.flatMap((city) => Array.from({ length: city.count }, () => city));
  const cluj = cities.find((city) => city.slug === "cluj-napoca")!;
  homeCities.push(...Array.from({ length: CLUJ_GINGIVAL_COUNT }, () => cluj));
  const firstNames = ["Ana", "Andrei", "Ioana", "Mihai", "Elena", "Vlad", "Maria", "Radu", "Daria", "Ștefan"];
  const lastNames = ["Popescu", "Ionescu", "Dumitrescu", "Stan", "Marin", "Rusu", "Dobre", "Munteanu", "Toma", "Petrescu", "Lazăr", "Neagu", "Voicu", "Matei"];
  const today = localDateForInstant(now);
  const plan: DemoDirectoryPlan = {
    users: [], profiles: [], locations: [], supervisors: [], treatments: [], slots: [], offerings: [], coverage: [],
  };
  const coverage = new Map<string, { city: string; treatment: string; students: Set<string> }>();

  for (const [index, identity] of directoryIdentities.entries()) {
    const isClujGingival = index >= BASE_DIRECTORY_COUNT;
    const city = homeCities[index];
    const universities = catalog.universities.filter((university) => university.city === city.name)
      .sort((left, right) => left.shortName.localeCompare(right.shortName));
    const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]} (Demo)`;
    plan.users.push({ id: identity.id, name, email: identity.email, emailVerified: true, role: "STUDENT" });
    plan.profiles.push({
      id: identity.profileId, userId: identity.id, publicSlug: identity.publicSlug,
      university: universities[index % universities.length].shortName, studyYear: index % 6 + 1,
      bio: index % 7 === 0 ? null : `Profil fictiv pentru testarea Universident, în ${city.name}. ${index % 2 === 0
        ? "Îmi place să explic fiecare etapă și să construiesc o relație bazată pe încredere."
        : "Pun accent pe comunicare, prevenție și confortul pacientului pe durata consultației."}`,
      isPublished: true, publishedAt: now,
      // Keep the original 100 students' refresh distribution unchanged when adding a cohort.
      lastRefreshedAt: new Date(now.getTime() - (5 + (index * 37 % BASE_DIRECTORY_COUNT) * 10) * 60_000),
    });
    const supervisorId = `${identity.prefix}-supervisor`;
    plan.supervisors.push({
      id: supervisorId, studentProfileId: identity.profileId,
      fullName: index % 2 === 0 ? "Alexandra Pavel (Demo)" : "Dan Georgescu (Demo)",
      academicTitle: index % 2 === 0 ? "Conf. dr." : "Șef lucr. dr.", deletedAt: null,
    });
    const secondCity = !isClujGingival && index % 5 === 0
      ? cities[(cities.findIndex((candidate) => candidate.id === city.id) + 1) % cities.length]
      : city;
    const locationCities = [city, secondCity];
    const locations = locationCities.map((locationCity, locationIndex) => ({
      id: `${identity.prefix}-location-${locationIndex + 1}`, studentProfileId: identity.profileId,
      cityId: locationCity.id, routeKey: locationIndex === 0 ? "dd0001" : "dd0002",
      name: locationIndex === 0 ? "Clinica demonstrativă Centru" : "Cabinet demonstrativ Campus",
      address: `Adresă fictivă ${index + 1}, ${locationCity.name}`,
      details: "Locație fictivă folosită exclusiv pentru testarea interfeței.", deletedAt: null,
    }));
    plan.locations.push(...locations);
    const treatmentIndexes = new Set(isClujGingival
      ? [treatments.findIndex((treatment) => treatment.slug === "afectiuni-gingivale")]
      : [0, 1 + index % (treatments.length - 1)]);
    if (!isClujGingival && index % 4 !== 3) treatmentIndexes.add(1);
    if (!isClujGingival && index % 5 === 0) treatmentIndexes.add(1 + (index + 3) % (treatments.length - 1));
    const offerings = [...treatmentIndexes].map((treatmentIndex) => {
      const treatment = treatments[treatmentIndex];
      return {
        id: `${identity.prefix}-treatment-${treatment.slug}`, studentProfileId: identity.profileId,
        treatmentId: treatment.id,
        description: `${treatment.name} — ofertă fictivă pentru testarea calendarului.`,
        durationMinutes: treatment.slug === "consultatie" && index % 3 === 0 ? 30 : treatment.durationMinutes,
        deletedAt: null,
      };
    });
    plan.treatments.push(...offerings);

    for (const [slotIndex, baseDay] of [1, 8, 15, 22, 36, 50].entries()) {
      const day = addLocalDays(today, baseDay + index % 6);
      const startMinute = (8 + (index + slotIndex) % 4 * 2) * 60;
      const duration = 180 + (index + slotIndex) % 3 * 60;
      const startsAt = utcInstantForBucharestLocal(day, startMinute);
      const endsAt = utcInstantForBucharestLocal(day, startMinute + duration);
      if (!startsAt || !endsAt) throw new Error(`Interval demo invalid: ${day}.`);
      const slotId = `${identity.prefix}-slot-${slotIndex + 1}`;
      plan.slots.push({
        id: slotId, studentProfileId: identity.profileId,
        studentLocationId: locations[slotIndex % locations.length].id,
        startsAt, endsAt, originalStartsAt: startsAt, seriesId: null, sequenceNumber: null,
        status: "ACTIVE", isException: false, sourceRevision: 0, version: 1, cancelledAt: null,
      });
      for (const offering of offerings) {
        plan.offerings.push({
          id: `${slotId}-${offering.treatmentId}`, slotId, studentProfileId: identity.profileId,
          studentTreatmentId: offering.id, supervisorId, removedAt: null,
        });
      }
    }
    for (const locationCity of locationCities) {
      for (const treatmentIndex of treatmentIndexes) {
        const treatment = treatments[treatmentIndex];
        const key = `${locationCity.slug}:${treatment.slug}`;
        const entry = coverage.get(key) ?? { city: locationCity.slug, treatment: treatment.slug, students: new Set<string>() };
        entry.students.add(identity.profileId);
        coverage.set(key, entry);
      }
    }
  }
  plan.coverage = [...coverage.values()].map(({ city, treatment, students }) => ({ city, treatment, profiles: students.size }))
    .sort((left, right) => left.city.localeCompare(right.city) || left.treatment.localeCompare(right.treatment));
  return plan;
}

export type DemoIdentityRow = { id: string; identity: string };

// Check BOTH deterministic IDs and natural unique keys; never adopt a foreign record.
export function assertDemoIdentities(label: string, expected: DemoIdentityRow[], existing: DemoIdentityRow[]) {
  const byId = new Map(expected.map((row) => [row.id, row.identity]));
  const byIdentity = new Map(expected.map((row) => [row.identity, row.id]));
  for (const row of existing) {
    if ((byId.has(row.id) && byId.get(row.id) !== row.identity) ||
        (byIdentity.has(row.identity) && byIdentity.get(row.identity) !== row.id)) {
      throw new Error(`Coliziune în ${label}: ${row.id}. Seed-ul nu preia și nu suprascrie înregistrări străine.`);
    }
  }
}

export function assertDemoCalendarSafe(
  plan: DemoDirectoryPlan,
  existing: { id: string; studentProfileId: string; startsAt: Date; endsAt: Date; status: string }[],
  dependentAppointments: number,
  activeSeries: number,
) {
  if (dependentAppointments > 0) {
    throw new Error("Există programări pe intervalele profilurilor demo. Rerularea a fost oprită pentru a le păstra; folosește datele existente sau o copie locală separată.");
  }
  if (activeSeries > 0) throw new Error("Există serii active adăugate profilurilor demo. Seed-ul nu modifică acest calendar manual.");
  const ids = new Set(plan.slots.map((slot) => slot.id));
  for (const slot of existing) {
    if (ids.has(slot.id) || slot.status !== "ACTIVE") continue;
    if (plan.slots.some((planned) => planned.studentProfileId === slot.studentProfileId &&
      new Date(planned.startsAt) < slot.endsAt && new Date(planned.endsAt) > slot.startsAt)) {
      throw new Error("Calendarul manual se suprapune cu un interval al profilurilor demo. Seed-ul a fost oprit fără modificări.");
    }
  }
}
