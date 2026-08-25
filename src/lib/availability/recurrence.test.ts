import assert from "node:assert/strict";
import test from "node:test";

import { StudentAvailabilityWeekday } from "@/generated/prisma/enums";
import {
  bucharestPartsForInstant,
  utcInstantForBucharestLocal,
} from "@/lib/availability/bucharest-time";
import { generateOccurrences } from "@/lib/availability/recurrence";

test("keeps the Bucharest wall-clock time over the DST transition", () => {
  const occurrences = generateOccurrences(
    {
      startsOn: "2026-03-23",
      startMinuteOfDay: 8 * 60,
      weekdays: [StudentAvailabilityWeekday.MONDAY],
      intervalWeeks: 1,
      durationMinutes: 45,
      endMode: "COUNT",
      endsOn: null,
      occurrenceCount: 3,
    },
    "2026-04-12",
  );

  assert.equal(occurrences.length, 3);
  assert.deepEqual(
    occurrences.map((occurrence) => bucharestPartsForInstant(occurrence.startsAt).hour),
    [8, 8, 8],
  );
  assert.notEqual(
    occurrences[1].startsAt.getTime() - occurrences[0].startsAt.getTime(),
    occurrences[2].startsAt.getTime() - occurrences[1].startsAt.getTime(),
  );
});

test("supports multiple weekdays and a biweekly anchor", () => {
  const occurrences = generateOccurrences(
    {
      startsOn: "2026-08-17",
      startMinuteOfDay: 9 * 60,
      weekdays: [
        StudentAvailabilityWeekday.MONDAY,
        StudentAvailabilityWeekday.WEDNESDAY,
      ],
      intervalWeeks: 2,
      durationMinutes: 60,
      endMode: "COUNT",
      endsOn: null,
      occurrenceCount: 4,
    },
    "2026-09-30",
  );

  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.localDate),
    ["2026-08-17", "2026-08-19", "2026-08-31", "2026-09-02"],
  );
});

test("returns no instant for a nonexistent Bucharest local time", () => {
  assert.equal(utcInstantForBucharestLocal("2026-03-29", 3 * 60 + 30), null);
});

test("omits the spring DST gap and continues the series", () => {
  const occurrences = generateOccurrences(
    {
      startsOn: "2026-03-22",
      startMinuteOfDay: 3 * 60 + 30,
      weekdays: [StudentAvailabilityWeekday.SUNDAY],
      intervalWeeks: 1,
      durationMinutes: 15,
      endMode: "COUNT",
      endsOn: null,
      occurrenceCount: 3,
    },
    "2026-04-12",
  );

  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.localDate),
    ["2026-03-22", "2026-04-05", "2026-04-12"],
  );
});

test("chooses the earlier instant during the autumn DST overlap", () => {
  const instant = utcInstantForBucharestLocal("2026-10-25", 3 * 60 + 30);
  assert.equal(instant?.toISOString(), "2026-10-25T00:30:00.000Z");
});

test("converts recurring end wall-clock separately across DST", () => {
  const [spring] = generateOccurrences(
    {
      startsOn: "2026-03-29",
      startMinuteOfDay: 60,
      weekdays: [StudentAvailabilityWeekday.SUNDAY],
      intervalWeeks: 1,
      durationMinutes: 180,
      endMode: "COUNT",
      endsOn: null,
      occurrenceCount: 1,
    },
    "2026-03-29",
  );
  assert.equal(bucharestPartsForInstant(spring.endsAt).hour, 4);
});

test("can omit a DST occurrence when its elapsed capacity cannot fit the offering", () => {
  const occurrences = generateOccurrences(
    {
      startsOn: "2026-03-29",
      startMinuteOfDay: 60,
      weekdays: [StudentAvailabilityWeekday.SUNDAY],
      intervalWeeks: 1,
      durationMinutes: 180,
      endMode: "COUNT",
      endsOn: null,
      occurrenceCount: 1,
    },
    "2026-04-05",
    { minimumElapsedDurationMinutes: 180 },
  );
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].localDate, "2026-04-05");
});

test("enforces an independent hard cap for generated occurrences", () => {
  assert.throws(
    () => generateOccurrences(
      {
        startsOn: "2026-01-01",
        startMinuteOfDay: 9 * 60,
        weekdays: Object.values(StudentAvailabilityWeekday),
        intervalWeeks: 1,
        durationMinutes: 15,
        endMode: "NEVER",
        endsOn: null,
        occurrenceCount: null,
      },
      "2026-01-31",
      { maxOccurrences: 3 },
    ),
    /prea multe apariții/,
  );
});
