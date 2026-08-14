import assert from "node:assert/strict";
import test from "node:test";

import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { ageOnDate } from "@/lib/availability/bucharest-time";

test("late cancellation reputation uses correct Romanian singular and plural", () => {
  assert.equal(formatLateCancellationReputation(0), "0 anulări târzii în ultimele 10 programări");
  assert.equal(formatLateCancellationReputation(1), "o anulare târzie în ultimele 10 programări");
  assert.equal(formatLateCancellationReputation(2), "2 anulări târzii în ultimele 10 programări");
});

test("appointment age is calculated for the slot date from the profile birth date", () => {
  const dateOfBirth = new Date("2000-08-20T00:00:00.000Z");
  assert.equal(ageOnDate(dateOfBirth, new Date("2026-08-19T08:00:00.000Z")), 25);
  assert.equal(ageOnDate(dateOfBirth, new Date("2026-08-20T08:00:00.000Z")), 26);
});
