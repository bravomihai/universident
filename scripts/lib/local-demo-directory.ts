import { policyConfirmations } from "../../src/lib/account/policy-confirmations";
import type { Prisma } from "../../src/generated/prisma/client";
import { addLocalDays, ageOnDate, localDateForInstant, utcInstantForBucharestLocal } from "../../src/lib/availability/bucharest-time";

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
  treatments: Prisma.StudentTreatmentCreateManyInput[];
  slots: Prisma.StudentAvailabilitySlotCreateManyInput[];
  offerings: Prisma.StudentAvailabilitySlotOfferingCreateManyInput[];
  history: {
    slots: Prisma.StudentAvailabilitySlotCreateManyInput[];
    offerings: Prisma.StudentAvailabilitySlotOfferingCreateManyInput[];
    appointments: Prisma.AppointmentCreateManyInput[];
    reviews: Prisma.AppointmentReviewCreateManyInput[];
  };
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

export const demoDirectoryPatient = {
  user: {
    id: "demo-ui-directory-patient-user",
    email: "patient@demo.universident.test",
    name: "Pacient fictiv (Demo)",
    role: "PATIENT",
    emailVerified: true,
  },
  profile: {
    id: "demo-ui-directory-patient-profile",
    userId: "demo-ui-directory-patient-user",
    profileSlug: "pacient-demo-catalog",
    dateOfBirth: new Date("1992-04-18T00:00:00Z"),
  },
} as const;

export function isDemoDirectoryPatient(user: {
  id: string; email: string; role: string;
  patientProfile: { id: string; profileSlug: string } | null;
}) {
  return user.role === demoDirectoryPatient.user.role &&
    user.id === demoDirectoryPatient.user.id &&
    user.email === demoDirectoryPatient.user.email &&
    user.patientProfile?.id === demoDirectoryPatient.profile.id &&
    user.patientProfile.profileSlug === demoDirectoryPatient.profile.profileSlug;
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
      throw new Error(`Missing city or active university for ${spec.slug}. Run npm run db:seed.`);
    }
    return { ...city, count: spec.count };
  });
  const treatments = demoDirectoryTreatments.map((spec) => {
    const treatment = catalog.treatments.find((candidate) => candidate.slug === spec.slug);
    if (!treatment) throw new Error(`Missing active treatment ${spec.slug}. Run npm run db:seed.`);
    return { ...treatment, durationMinutes: spec.durationMinutes };
  });
  const homeCities = cities.flatMap((city) => Array.from({ length: city.count }, () => city));
  const cluj = cities.find((city) => city.slug === "cluj-napoca")!;
  homeCities.push(...Array.from({ length: CLUJ_GINGIVAL_COUNT }, () => cluj));
  const firstNames = ["Ana", "Andrei", "Ioana", "Mihai", "Elena", "Vlad", "Maria", "Radu", "Daria", "Ștefan"];
  const lastNames = ["Popescu", "Ionescu", "Dumitrescu", "Stan", "Marin", "Rusu", "Dobre", "Munteanu", "Toma", "Petrescu", "Lazăr", "Neagu", "Voicu", "Matei"];
  const today = localDateForInstant(now);
  const plan: DemoDirectoryPlan = {
    users: [], profiles: [], locations: [], treatments: [], slots: [], offerings: [], coverage: [],
    history: { slots: [], offerings: [], appointments: [], reviews: [] },
  };
  const coverage = new Map<string, { city: string; treatment: string; students: Set<string> }>();

  for (const [index, identity] of directoryIdentities.entries()) {
    const isClujGingival = index >= BASE_DIRECTORY_COUNT;
    const refreshRank = index * 37 % BASE_DIRECTORY_COUNT;
    const hasDemoHistory = refreshRank < 8;
    const city = homeCities[index];
    const universities = catalog.universities.filter((university) => university.city === city.name)
      .sort((left, right) => left.shortName.localeCompare(right.shortName));
    const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]} (Demo)`;
    plan.users.push({ id: identity.id, name, email: identity.email, emailVerified: true, role: "STUDENT", signupPolicyVersion: policyConfirmations.studentDeclaration.version, signupPolicyConfirmedAt: now });
    const profile = {
      id: identity.profileId, userId: identity.id, publicSlug: identity.publicSlug,
      university: universities[index % universities.length].shortName, studyYear: index % 6 + 1,
      bio: index % 7 === 0 ? null : `Profil fictiv pentru testarea Universident, în ${city.name}. ${index % 2 === 0
        ? "Îmi place să explic fiecare etapă și să construiesc o relație bazată pe încredere."
        : "Pun accent pe comunicare, prevenție și confortul pacientului pe durata consultației."}`,
      isPublished: true, publishedAt: now,
      // Keep the original 100 students' refresh distribution unchanged when adding a cohort.
      lastRefreshedAt: new Date(now.getTime() - (5 + refreshRank * 10) * 60_000),
      ...(hasDemoHistory && refreshRank % 2 === 0 ? { showCompletedAppointmentsCount: true } : {}),
    };
    plan.profiles.push(profile);
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
      if (!startsAt || !endsAt) throw new Error(`Invalid demo slot on ${day}.`);
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
          studentTreatmentId: offering.id, removedAt: null,
        });
      }
    }
    if (hasDemoHistory) {
      const location = locations[0];
      const offering = offerings[0];
      const treatment = treatments.find((candidate) => candidate.id === offering.treatmentId)!;
      const { user: patient, profile: patientProfile } = demoDirectoryPatient;
      // Fixed dates keep the history stable while seed reruns move the future calendar.
      for (let visit = 0; visit <= index % 3; visit += 1) {
        const key = `${identity.prefix}-history-${visit + 1}`;
        const day = addLocalDays("2025-01-06", index * 3 + visit);
        const startsAt = utcInstantForBucharestLocal(day, 10 * 60);
        const endsAt = utcInstantForBucharestLocal(day, 10 * 60 + offering.durationMinutes);
        if (!startsAt || !endsAt) throw new Error(`Invalid demo appointment on ${day}.`);
        const slotId = `${key}-slot`;
        const offeringId = `${key}-offering`;
        const appointmentId = `${key}-appointment`;
        const confirmedAt = new Date(startsAt.getTime() - 24 * 60 * 60_000);
        const publishedAt = new Date(endsAt.getTime() + 45 * 60_000);
        plan.history.slots.push({
          id: slotId, studentProfileId: profile.id, studentLocationId: location.id,
          startsAt, endsAt, originalStartsAt: startsAt, seriesId: null, status: "ACTIVE", createdAt: confirmedAt,
        });
        plan.history.offerings.push({
          id: offeringId, slotId, studentProfileId: profile.id,
          studentTreatmentId: offering.id, createdAt: confirmedAt,
        });
        plan.history.appointments.push({
          id: appointmentId, routeSlug: `${key}-completed`,
          patientProfileId: patientProfile.id, studentProfileId: profile.id,
          studentAvailabilitySlotId: slotId, studentAvailabilitySlotOfferingId: offeringId,
          scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
          patientAgeAtAppointment: ageOnDate(patientProfile.dateOfBirth, startsAt),
          patientNameSnapshot: patient.name, studentNameSnapshot: name,
          treatmentNameSnapshot: treatment.name, locationNameSnapshot: location.name,
          locationAddressSnapshot: location.address, studentUniversitySnapshot: profile.university,
          status: "COMPLETED", confirmedAt, completedAt: endsAt, statusChangedAt: endsAt,
          statusChangedByUserId: identity.id, createdAt: confirmedAt,
        });
        plan.history.reviews.push(
          {
            id: `${key}-student-review`, appointmentId, authorRole: "STUDENT",
            authorUserId: identity.id, targetUserId: patient.id, rating: 5,
            submittedAt: endsAt, publishedAt, createdAt: endsAt,
          },
          {
            id: `${key}-patient-review`, appointmentId, authorRole: "PATIENT",
            authorUserId: patient.id, targetUserId: identity.id, rating: visit % 2 === 0 ? 5 : 4,
            submittedAt: publishedAt, publishedAt, createdAt: publishedAt,
          },
        );
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
      throw new Error(`Identity conflict in ${label}: ${row.id}. The demo seed cannot take ownership of or overwrite records outside its fixture set.`);
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
    throw new Error("Appointments exist on demo profile slots. The demo seed stopped to preserve them. Use the existing data or a separate local database.");
  }
  if (activeSeries > 0) throw new Error("Demo profiles have active recurring availability. The demo seed cannot modify this manually configured calendar.");
  const plannedSlots = [...plan.slots, ...plan.history.slots];
  const ids = new Set(plannedSlots.map((slot) => slot.id));
  for (const slot of existing) {
    if (ids.has(slot.id) || slot.status !== "ACTIVE") continue;
    if (plannedSlots.some((planned) => planned.studentProfileId === slot.studentProfileId &&
      new Date(planned.startsAt) < slot.endsAt && new Date(planned.endsAt) > slot.startsAt)) {
      throw new Error("Manually configured availability overlaps a demo profile slot. The demo seed stopped without making changes.");
    }
  }
}
