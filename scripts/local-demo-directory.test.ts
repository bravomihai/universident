import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { localDateForInstant } from "../src/lib/availability/bucharest-time";
import { generatePublicBookingSlots } from "../src/lib/availability/public-booking-slots";
import {
  assertDemoCalendarSafe, assertDemoIdentities, buildDemoDirectory,
  demoDirectoryCities, demoDirectoryTreatments, isDemoDirectoryStudent,
} from "./lib/local-demo-directory";
import { validateDemoDirectory, writeDemoDirectory } from "./lib/local-demo-directory-store";

const catalog = {
  cities: demoDirectoryCities.map((city) => ({ id: `city-${city.slug}`, slug: city.slug, name: city.slug })),
  treatments: demoDirectoryTreatments.map((treatment) => ({ id: `treatment-${treatment.slug}`, slug: treatment.slug, name: treatment.slug })),
  universities: demoDirectoryCities.map((city) => ({ shortName: `UMF ${city.slug}`, city: city.slug })),
};
const now = new Date("2026-09-07T11:00:00Z");
const plan = buildDemoDirectory(catalog, now);

test("directory contains exactly 140 unique published, recently refreshed fictional students", () => {
  assert.equal(plan.users.length, 140);
  assert.equal(plan.profiles.length, 140);
  assert.equal(plan.locations.length, 280);
  assert.equal(plan.slots.length, 840);
  assert.equal(new Set(plan.users.map((user) => user.email)).size, 140);
  assert.equal(new Set(plan.profiles.map((profile) => profile.publicSlug)).size, 140);
  assert.equal(new Set(plan.users.map((user) => user.name)).size, 140);
  for (const user of plan.users) {
    assert.match(user.email, /@demo\.universident\.test$/);
    assert.match(user.name, /\(Demo\)$/);
    assert.equal(user.role, "STUDENT");
    assert.equal(user.emailVerified, true);
    assert.equal("password" in user, false);
  }
  for (const profile of plan.profiles) {
    assert.equal(profile.isPublished, true);
    assert.ok(profile.studyYear >= 1 && profile.studyYear <= 6);
    assert.ok(catalog.universities.some((university) => university.shortName === profile.university));
    const age = now.getTime() - new Date(profile.lastRefreshedAt!).getTime();
    assert.ok(age > 0 && age < 20 * 60 * 60_000);
  }
  assert.ok(plan.profiles.some((profile) => profile.bio === null));
});

test("adding the gingival cohort preserves all generated data for the original 100 students", () => {
  const originalIds = new Set(plan.profiles.slice(0, 100).map((profile) => profile.id));
  const originalRows = {
    users: plan.users.slice(0, 100),
    profiles: plan.profiles.slice(0, 100),
    locations: plan.locations.filter((row) => originalIds.has(row.studentProfileId)),
    supervisors: plan.supervisors.filter((row) => originalIds.has(row.studentProfileId)),
    treatments: plan.treatments.filter((row) => originalIds.has(row.studentProfileId)),
    slots: plan.slots.filter((row) => originalIds.has(row.studentProfileId)),
    offerings: plan.offerings.filter((row) => originalIds.has(row.studentProfileId)),
  };
  // Snapshot of the original generator using the fixed catalog/date above, before adding 101–140.
  assert.equal(createHash("sha256").update(JSON.stringify(originalRows)).digest("hex"),
    "bd0d258c4abc0a9d331177691a4b721a49250f2d5fd83e51485a7514798021cc");
});

test("forty additional students offer gingival treatment in Cluj with future capacity at both locations", () => {
  const additional = plan.profiles.slice(100);
  assert.equal(additional.length, 40);
  assert.equal(additional[0].publicSlug, "student-demo-101");
  assert.equal(additional[39].publicSlug, "student-demo-140");
  for (const profile of additional) {
    const treatments = plan.treatments.filter((row) => row.studentProfileId === profile.id);
    assert.equal(treatments.length, 1);
    assert.equal(treatments[0].treatmentId, "treatment-afectiuni-gingivale");
    assert.equal(treatments[0].durationMinutes, 60);
    const locations = plan.locations.filter((row) => row.studentProfileId === profile.id);
    assert.equal(locations.length, 2);
    for (const location of locations) {
      assert.equal(location.cityId, "city-cluj-napoca");
      const slots = plan.slots.filter((slot) => slot.studentLocationId === location.id);
      assert.equal(slots.length, 3);
      for (const slot of slots) {
        assert.ok(new Date(slot.startsAt) > now);
        assert.ok(plan.offerings.some((offering) => offering.slotId === slot.id && offering.studentTreatmentId === treatments[0].id));
      }
    }
  }
  // Four matches existed in the original cohort, plus the 40 requested new people.
  assert.equal(plan.coverage.find((row) => row.city === "cluj-napoca" && row.treatment === "afectiuni-gingivale")!.profiles, 44);
});

test("coverage spans eleven cities and nine treatments, with multiple pages and multi-city students", () => {
  assert.equal(new Set(plan.coverage.map((row) => row.city)).size, 11);
  assert.equal(new Set(plan.coverage.map((row) => row.treatment)).size, 9);
  for (const city of ["cluj-napoca", "bucuresti"]) {
    for (const treatment of ["consultatie", "igienizare"]) {
      assert.ok(plan.coverage.find((row) => row.city === city && row.treatment === treatment)!.profiles > 12);
    }
  }
  assert.equal(plan.profiles.filter((profile) => new Set(plan.locations.filter((location) => location.studentProfileId === profile.id).map((location) => location.cityId)).size === 2).length, 20);
  const recent = [...plan.profiles].sort((left, right) => new Date(right.lastRefreshedAt!).getTime() - new Date(left.lastRefreshedAt!).getTime()).slice(0, 8);
  assert.ok(new Set(recent.map((profile) => profile.university)).size >= 4);
});

test("every advertised treatment has real sliceable capacity in its exact location, within 60 days", () => {
  const through = new Date(now.getTime() + 60 * 24 * 60 * 60_000);
  const actualCoverage = new Map<string, Set<string>>();
  for (const slot of plan.slots) {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    assert.ok(startsAt > now && endsAt < through);
    assert.equal(localDateForInstant(startsAt), localDateForInstant(endsAt));
    const location = plan.locations.find((location) => location.id === slot.studentLocationId)!;
    assert.equal(location.studentProfileId, slot.studentProfileId);
    const city = catalog.cities.find((city) => city.id === location.cityId)!;
    const offerings = plan.offerings.filter((offering) => offering.slotId === slot.id).map((offering) => {
      const treatment = plan.treatments.find((treatment) => treatment.id === offering.studentTreatmentId)!;
      assert.equal(treatment.studentProfileId, slot.studentProfileId);
      assert.equal(plan.supervisors.find((supervisor) => supervisor.id === offering.supervisorId)!.studentProfileId, slot.studentProfileId);
      return { id: offering.id!, studentTreatment: { durationMinutes: treatment.durationMinutes, treatment: { slug: catalog.treatments.find((row) => row.id === treatment.treatmentId)!.slug } } };
    });
    for (const offering of offerings) {
      const slug = offering.studentTreatment.treatment.slug;
      const windows = generatePublicBookingSlots([{ id: slot.id!, startsAt, endsAt, offerings, appointments: [] }], slug, now, through, now);
      assert.ok(windows.length > 0, `${slot.id}: ${slug}`);
      const key = `${city.slug}:${slug}`;
      const students = actualCoverage.get(key) ?? new Set<string>();
      students.add(slot.studentProfileId);
      actualCoverage.set(key, students);
    }
    assert.equal(plan.slots.some((other) => other.id !== slot.id && other.studentProfileId === slot.studentProfileId && new Date(other.startsAt) < endsAt && new Date(other.endsAt) > startsAt), false);
  }
  assert.equal(actualCoverage.size, plan.coverage.length);
  for (const row of plan.coverage) assert.equal(actualCoverage.get(`${row.city}:${row.treatment}`)?.size, row.profiles);
});

test("identities are stable on rerun and dates shift in Bucharest time across DST", () => {
  for (const date of ["2026-03-27T12:00:00Z", "2026-10-23T12:00:00Z", "2027-01-10T12:00:00Z"]) {
    const regenerated = buildDemoDirectory(catalog, new Date(date));
    assert.deepEqual(regenerated.users, plan.users);
    assert.deepEqual(regenerated.slots.map((slot) => slot.id), plan.slots.map((slot) => slot.id));
    for (const [index, slot] of regenerated.slots.entries()) {
      assert.equal(localDateForInstant(new Date(slot.startsAt)), localDateForInstant(new Date(slot.endsAt)));
      assert.equal(new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime(), new Date(plan.slots[index].endsAt).getTime() - new Date(plan.slots[index].startsAt).getTime());
      const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit" }).format(new Date(slot.startsAt));
      assert.equal(hour, new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit" }).format(new Date(plan.slots[index].startsAt)));
    }
  }
});

test("missing active catalogs fail before writing instead of generating invalid data", () => {
  assert.throws(() => buildDemoDirectory({ ...catalog, cities: catalog.cities.slice(1) }, now), /Lipsește/);
  assert.throws(() => buildDemoDirectory({ ...catalog, treatments: catalog.treatments.slice(1) }, now), /Lipsește/);
  assert.throws(() => buildDemoDirectory({ ...catalog, universities: [] }, now), /Lipsește/);
});

test("original scenario selection excludes only exact demo identities", () => {
  const user = plan.users[0];
  const profile = plan.profiles[0];
  const candidate = { ...user, role: "STUDENT", studentProfile: { id: profile.id!, publicSlug: profile.publicSlug! } };
  assert.equal(isDemoDirectoryStudent(candidate), true);
  assert.equal(isDemoDirectoryStudent({ ...candidate, id: "real-user" }), false);
  assert.equal(isDemoDirectoryStudent({ ...candidate, email: "real@example.test" }), false);
  assert.equal(isDemoDirectoryStudent({ ...candidate, studentProfile: null }), false);
});

test("ID, ownership and natural-key collisions are rejected; unrelated records are preserved", () => {
  const expected = [{ id: "demo-1", identity: "owner-1:route-1" }];
  assert.doesNotThrow(() => assertDemoIdentities("test", expected, [...expected, { id: "manual-1", identity: "other-owner:route-1" }]));
  assert.throws(() => assertDemoIdentities("test", expected, [{ id: "demo-1", identity: "foreign-owner:route-1" }]), /Coliziune/);
  assert.throws(() => assertDemoIdentities("test", expected, [{ id: "manual-1", identity: "owner-1:route-1" }]), /Coliziune/);
});

test("manual appointments, active series and overlapping calendar entries stop reruns", () => {
  assert.throws(() => assertDemoCalendarSafe(plan, [], 1, 0), /programări/);
  assert.throws(() => assertDemoCalendarSafe(plan, [], 0, 1), /serii active/);
  const slot = plan.slots[0];
  const existing = { id: "manual-slot", studentProfileId: slot.studentProfileId, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), status: "ACTIVE" };
  assert.throws(() => assertDemoCalendarSafe(plan, [existing], 0, 0), /suprapune/);
  assert.doesNotThrow(() => assertDemoCalendarSafe(plan, [{ ...existing, id: slot.id! }], 0, 0));
  assert.doesNotThrow(() => assertDemoCalendarSafe(plan, [{ ...existing, status: "CANCELLED" }], 0, 0));
  assert.doesNotThrow(() => assertDemoCalendarSafe(plan, [{ ...existing, studentProfileId: "someone-else" }], 0, 0));
  assert.doesNotThrow(() => assertDemoCalendarSafe(plan, [{ ...existing, startsAt: existing.endsAt, endsAt: new Date(existing.endsAt.getTime() + 60_000) }], 0, 0));
});

type StoredRow = { id: string } & Record<string, unknown>;
function memoryStore() {
  const models = ["user", "studentProfile", "studentLocation", "studentSupervisor", "studentTreatment", "studentAvailabilitySlot", "studentAvailabilitySlotOffering"];
  const tables = new Map(models.map((model) => [model, [] as StoredRow[]]));
  const calls: string[] = [];
  const client = Object.fromEntries(models.map((model) => [model, {
    findMany: async () => tables.get(model)!,
    createMany: async ({ data }: { data: StoredRow[] }) => {
      calls.push(`create:${model}`);
      const rows = tables.get(model)!;
      for (const row of data) {
        assert.equal(rows.some((existing) => existing.id === row.id), false);
        rows.push({ ...row });
      }
    },
    update: async ({ where, data }: { where: { id: string }; data: StoredRow }) => {
      calls.push(`update:${model}`);
      const existing = tables.get(model)!.find((row) => row.id === where.id)!;
      const updated = { ...data };
      if (typeof data.version === "object") updated.version = Number(existing.version) + 1;
      Object.assign(existing, updated);
    },
    updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: StoredRow }) => {
      calls.push(`updateMany:${model}`);
      for (const row of tables.get(model)!) if (where.id.in.includes(row.id)) Object.assign(row, data);
    },
  }]));
  client.appointment = { count: async () => 0 } as unknown as typeof client.user;
  client.studentAvailabilitySeries = { count: async () => 0 } as unknown as typeof client.user;
  return { tables, calls, client: client as unknown as Parameters<typeof validateDemoDirectory>[0] };
}

test("preflight is read-only; first population batches writes; rerun creates no duplicates", async () => {
  const store = memoryStore();
  const empty = await validateDemoDirectory(store.client, plan);
  assert.equal(store.calls.length, 0);
  await writeDemoDirectory(store.client, plan, empty, now);
  assert.equal(store.calls.filter((call) => call.startsWith("create:")).length, 7);
  assert.equal(store.tables.get("user")!.length, 140);
  assert.equal(store.tables.get("studentAvailabilitySlot")!.length, 840);
  const counts = [...store.tables].map(([model, rows]) => [model, rows.length]);
  const next = buildDemoDirectory(catalog, new Date("2026-09-08T11:00:00Z"));
  const previous = await validateDemoDirectory(store.client, next);
  store.calls.length = 0;
  await writeDemoDirectory(store.client, next, previous, now);
  assert.deepEqual([...store.tables].map(([model, rows]) => [model, rows.length]), counts);
  assert.equal(store.calls.some((call) => call.startsWith("create:")), false);
  assert.equal(store.tables.get("studentAvailabilitySlot")![0].version, 2);
});

test("preflight rejects foreign email, profile slug, location key and fixture ownership", async () => {
  for (const [model, row] of [
    ["user", { id: "foreign", email: plan.users[0].email, role: "PATIENT" }],
    ["studentProfile", { id: "foreign", userId: "foreign-user", publicSlug: plan.profiles[0].publicSlug }],
    ["studentLocation", { ...plan.locations[0], id: "foreign" }],
    ["studentAvailabilitySlot", { ...plan.slots[0], studentProfileId: "foreign-profile" }],
  ] as [string, StoredRow][]) {
    const store = memoryStore();
    store.tables.get(model)!.push(row);
    await assert.rejects(validateDemoDirectory(store.client, plan), /Coliziune/);
    assert.equal(store.calls.length, 0);
  }
});

test("preflight preserves manually added offerings rather than removing them", async () => {
  const store = memoryStore();
  store.tables.get("studentAvailabilitySlotOffering")!.push({ ...plan.offerings[0], id: "manual-offering" });
  await assert.rejects(validateDemoDirectory(store.client, plan), /oferte adăugate manual/);
  assert.equal(store.calls.length, 0);
});
