import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedMaterializationThrough,
  rollingMaterializationThrough,
  validateStudentCalendarRange,
} from "@/lib/availability/limits";

const now = new Date("2026-08-16T09:00:00.000Z");

test("rejects a calendar query in the year 9999", () => {
  const result = validateStudentCalendarRange(
    new Date("9999-01-01T00:00:00.000Z"),
    new Date("9999-01-02T00:00:00.000Z"),
    now,
  );
  assert.equal(result.ok, false);
});

test("bounds materialization to the rolling 180-day horizon", () => {
  assert.equal(rollingMaterializationThrough(now), "2027-02-12");
  assert.equal(boundedMaterializationThrough("9999-01-01", now), "2027-02-12");
  assert.equal(boundedMaterializationThrough("2026-10-01", now), "2026-10-01");
});
