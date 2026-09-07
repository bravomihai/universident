import assert from "node:assert/strict";
import test from "node:test";
import { utcInstantForBucharestLocal } from "../src/lib/availability/bucharest-time";
import { placeLocalDemoSlots } from "./lib/local-demo-schedule";

function interval(day: string, startMinute = 8 * 60, endMinute = 12 * 60) {
  return { startsAt: utcInstantForBucharestLocal(day, startMinute)!, endsAt: utcInstantForBucharestLocal(day, endMinute)! };
}

test("demo slots avoid existing intervals without moving historical cases into the future", () => {
  const original = [
    { key: "future", dayOffset: 1, startMinute: 480, endMinute: 720 },
    { key: "past", dayOffset: -1, startMinute: 480, endMinute: 720 },
  ];
  const planned = placeLocalDemoSlots(original, "2026-09-06", [interval("2026-09-07"), interval("2026-09-05")]);
  assert.deepEqual(planned.map((slot) => slot.dayOffset), [2, -2]);
  assert.deepEqual(original.map((slot) => slot.dayOffset), [1, -1]);
});

test("demo slots reserve each other and permit adjacent non-overlapping windows", () => {
  const planned = placeLocalDemoSlots([
    { dayOffset: 1, startMinute: 480, endMinute: 720 },
    { dayOffset: 1, startMinute: 480, endMinute: 720 },
    { dayOffset: 1, startMinute: 720, endMinute: 780 },
  ], "2026-09-06", []);
  assert.deepEqual(planned.map((slot) => slot.dayOffset), [1, 2, 1]);
});

test("demo schedule rejects exhausted availability instead of overwriting existing slots", () => {
  assert.throws(() => placeLocalDemoSlots([
    { dayOffset: 1, startMinute: 480, endMinute: 720 },
  ], "2026-09-06", [{ startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-09-01T00:00:00Z") }]), /90/);
});
