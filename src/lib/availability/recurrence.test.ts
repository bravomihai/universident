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

test("rejects a nonexistent Bucharest local time", () => {
  assert.equal(utcInstantForBucharestLocal("2026-03-29", 3 * 60 + 30), null);
});

