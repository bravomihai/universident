import assert from "node:assert/strict";
import test from "node:test";

import { rankUniquePublicStudents } from "@/lib/public-students/public-student-search-ranking";

test("students appear once and are ordered by their earliest real availability", () => {
  const ranked = rankUniquePublicStudents([
    {
      studentProfileId: "student-one",
      studentName: "Student unu",
      locationKey: "location-late",
      firstAvailableAt: new Date("2026-08-16T10:00:00.000Z"),
      tieBreaker: "location-late",
      value: "student-one-late",
    },
    {
      studentProfileId: "student-two",
      studentName: "Student doi",
      locationKey: "location-only",
      firstAvailableAt: new Date("2026-08-15T10:00:00.000Z"),
      tieBreaker: "location-only",
      value: "student-two",
    },
    {
      studentProfileId: "student-one",
      studentName: "Student unu",
      locationKey: "location-early",
      firstAvailableAt: new Date("2026-08-14T10:00:00.000Z"),
      tieBreaker: "location-early",
      value: "student-one-early",
    },
    {
      studentProfileId: "student-one",
      studentName: "Student unu",
      locationKey: "location-early",
      firstAvailableAt: new Date("2026-08-17T10:00:00.000Z"),
      tieBreaker: "location-early-later-block",
      value: "student-one-later-block",
    },
  ]);

  assert.deepEqual(
    ranked.map((item) => ({
      value: item.value,
      locationCount: item.locationCount,
    })),
    [
      { value: "student-one-early", locationCount: 2 },
      { value: "student-two", locationCount: 1 },
    ],
  );
});
