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

test("accepts a recurring availability with an explicit occurrence count", () => {
  const parsed = parseCreateAvailabilityInput({
    kind: "RECURRING",
    ...configuration,
    rule: boundedRule,
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.data.kind !== "RECURRING") return;
  assert.equal(parsed.data.rule.occurrenceCount, 8);
  assert.equal(parsed.data.rule.endsOn, null);
});

test("requires a series revision and recurrence rule for a series edit", () => {
  const parsed = parseUpdateAvailabilityInput({
    scope: "SERIES",
    ...configuration,
    startsAt: "2026-08-17T06:00:00.000Z",
    endsAt: "2026-08-17T07:30:00.000Z",
    expectedVersion: 1,
  });

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
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.scope, "SERIES");
  assert.equal(parsed.data.expectedSeriesRevision, 3);
  assert.equal(parsed.data.rule?.endsOn, "2026-10-12");
});
