import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRecentStudentAvailability } from "./recent-student-availability";
import { createRecentPublicStudent } from "./recent-public-student-dto";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 5, hour, minute));
const block = {
  id: "block", studentProfileId: "student", cityName: "București",
  startsAt: at(9), endsAt: at(12), occupied: [],
  offerings: [{ id: "offering", durationMinutes: 60, treatmentName: "Tratament" }],
};

test("recent profiles require real future capacity, not just a future block", () => {
  for (const candidate of [
    { ...block, occupied: [{ startsAt: at(9), endsAt: at(12) }] },
    { ...block, endsAt: at(9, 30) },
    { ...block, offerings: [] },
    { ...block, startsAt: at(6), endsAt: at(7) },
  ]) {
    assert.equal(summarizeRecentStudentAvailability([candidate], at(8)).size, 0);
  }
});

test("fragmented capacity is not added up to invent a bookable interval", () => {
  const result = summarizeRecentStudentAvailability([{
    ...block, endsAt: at(11),
    occupied: [{ startsAt: at(9, 30), endsAt: at(10, 30) }],
  }], at(8));
  assert.equal(result.size, 0);
});

test("only bookable treatments and cities appear once in the summary", () => {
  const result = summarizeRecentStudentAvailability([
    block,
    { ...block, id: "repeat" },
    { ...block, id: "short", cityName: "Cluj-Napoca", endsAt: at(9, 30), offerings: [
      ...block.offerings,
      { id: "short-offering", durationMinutes: 30, treatmentName: "Consultație" },
    ] },
    { ...block, id: "full", cityName: "Iași", occupied: [{ startsAt: at(9), endsAt: at(12) }] },
  ], at(8));
  assert.equal(result.size, 1);
  assert.deepEqual([...result.get("student")!.cities], ["București", "Cluj-Napoca"]);
  assert.deepEqual([...result.get("student")!.treatments], ["Tratament", "Consultație"]);
});

test("public recent profile DTO excludes private fields even when present on the source", () => {
  const source = {
    id: "internal-profile-id", userId: "internal-user-id",
    user: { name: "Student", email: "private@example.test", dateOfBirth: "2000-01-01" },
    publicSlug: "student", university: "Universitate", studyYear: 4,
    profileImage: { id: "image-id", updatedAt: at(8) }, lastRefreshedAt: at(8),
    appointments: [{ patientName: "Private", note: "Private" }],
  };
  const dto = createRecentPublicStudent(source, { cities: new Set(["Iași", "București"]), treatments: new Set(["Tratament"]) });
  assert.ok(dto);
  assert.deepEqual(Object.keys(dto).sort(), ["cities", "imageUrl", "name", "publicSlug", "refreshedAt", "studyYear", "treatments", "university"].sort());
  assert.equal(dto.name, "Student");
  assert.equal(dto.refreshedAt, at(8).toISOString());
  assert.deepEqual(dto.cities, ["București", "Iași"]);
  assert.equal(dto.imageUrl, `/api/student-profile-images/image-id?v=${at(8).getTime()}`);
  assert.equal(createRecentPublicStudent({ ...source, publicSlug: null }, { cities: new Set(), treatments: new Set() }), null);
  assert.equal(createRecentPublicStudent({ ...source, lastRefreshedAt: null }, { cities: new Set(), treatments: new Set() }), null);
});
