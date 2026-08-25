import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCreateAvailabilityInput,
  parseUpdateAvailabilityInput,
} from "@/lib/availability/availability-input";

const configuration = {
  studentLocationId: "location-1",
  offerings: [
    {
      studentTreatmentId: "treatment-1",
      supervisorId: "supervisor-1",
    },
  ],
};

const boundedRule = {
  startsOn: "2026-08-17",
  startMinuteOfDay: 9 * 60,
  durationMinutes: 90,
  weekdays: ["MONDAY"],
  intervalWeeks: 1,
  endMode: "COUNT",
  occurrenceCount: 8,
};

const now = new Date("2026-08-16T09:00:00.000Z");

test("accepts a recurring availability with an explicit occurrence count", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: boundedRule,
  }, now);

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.data.kind !== "RECURRING") return;
  assert.equal(parsed.data.rule.occurrenceCount, 8);
  assert.equal(parsed.data.rule.endsOn, null);
});

test("rejects a one-off availability that crosses a Bucharest calendar day", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "SINGLE",
    ...configuration,
    startsAt: "2026-08-17T20:30:00.000Z",
    endsAt: "2026-08-17T22:00:00.000Z",
  }, now);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.error, "Intervalul trebuie să se încheie în aceeași zi.");
  }
});

test("rejects an availability edit that crosses a Bucharest calendar day", () => {
  const parsed = parseUpdateAvailabilityInput({
    scope: "OCCURRENCE",
    ...configuration,
    startsAt: "2026-08-17T20:30:00.000Z",
    endsAt: "2026-08-17T22:00:00.000Z",
    expectedVersion: 1,
  }, now);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.error, "Intervalul trebuie să se încheie în aceeași zi.");
  }
});

test("requires a series revision and recurrence rule for a series edit", () => {
  const parsed = parseUpdateAvailabilityInput({
    scope: "SERIES",
    ...configuration,
    startsAt: "2026-08-17T06:00:00.000Z",
    endsAt: "2026-08-17T07:30:00.000Z",
    expectedVersion: 1,
  }, now);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error, "Revizia seriei nu este validă.");
});

test("parses the bounded replacement rule for a series edit", () => {
  const parsed = parseUpdateAvailabilityInput({
    scope: "SERIES",
    ...configuration,
    startsAt: "2026-08-17T06:00:00.000Z",
    endsAt: "2026-08-17T07:30:00.000Z",
    expectedVersion: 2,
    expectedSeriesRevision: 3,
    rule: {
      ...boundedRule,
      endMode: "UNTIL",
      occurrenceCount: null,
      endsOn: "2026-10-12",
    },
  }, now);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.scope, "SERIES");
  assert.equal(parsed.data.expectedSeriesRevision, 3);
  assert.equal(parsed.data.rule?.endsOn, "2026-10-12");
});

test("rejects a recurring availability without an explicit end", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: { ...boundedRule, endMode: "NEVER", occurrenceCount: null },
  }, now);
  assert.equal(parsed.ok, false);
});

test("rejects starts outside the 15-minute grid", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: { ...boundedRule, startMinuteOfDay: 9 * 60 + 7 },
  }, now);
  assert.equal(parsed.ok, false);
});

test("rejects seconds, milliseconds and non-exact durations", () => {
  const withSeconds = parseCreateAvailabilityInput({
    kind: "SINGLE",
    ...configuration,
    startsAt: "2026-08-17T06:00:01.000Z",
    endsAt: "2026-08-17T06:45:00.000Z",
  }, now);
  const withMilliseconds = parseCreateAvailabilityInput({
    kind: "SINGLE",
    ...configuration,
    startsAt: "2026-08-17T06:00:00.001Z",
    endsAt: "2026-08-17T06:45:00.000Z",
  }, now);
  const roundedBefore = parseCreateAvailabilityInput({
    kind: "SINGLE",
    ...configuration,
    startsAt: "2026-08-17T06:00:00.000Z",
    endsAt: "2026-08-17T06:44:31.000Z",
  }, now);
  assert.equal(withSeconds.ok, false);
  assert.equal(withMilliseconds.ok, false);
  assert.equal(roundedBefore.ok, false);
});

test("rejects a recurring interval ending at local midnight", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: { ...boundedRule, startMinuteOfDay: 23 * 60, durationMinutes: 60 },
  }, now);
  assert.equal(parsed.ok, false);
});

test("rejects a recurring start beyond the rolling horizon", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: { ...boundedRule, startsOn: "9999-01-01" },
  }, now);
  assert.equal(parsed.ok, false);
});
