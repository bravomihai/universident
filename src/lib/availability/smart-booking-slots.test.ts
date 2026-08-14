import assert from "node:assert/strict";
import test from "node:test";

import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";

function at(hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 7, 20, hour, minute));
}

test("keeps a non-overlapping layout that leaves reusable time", () => {
    const slots = generateSmartBookingSlots([{
      id: "block",
      offeringId: "offering",
      startsAt: at(9),
      endsAt: at(13),
      treatmentDurationMinutes: 45,
      offeredDurationsMinutes: [45, 60],
      occupied: [],
    }], at(8));

    assert.equal(slots.length, 4);
    assert.equal(slots.every((slot) => slot.optimized), true);
    assert.deepEqual(slots.map((slot) => slot.startsAt.toISOString()), [at(9).toISOString(), at(9, 45).toISOString(), at(10, 30).toISOString(), at(11, 15).toISOString()]);
});

test("falls back to every valid grid start when no exact packing exists", () => {
    const slots = generateSmartBookingSlots([{
      id: "block",
      offeringId: "offering",
      startsAt: at(9),
      endsAt: at(10, 10),
      treatmentDurationMinutes: 45,
      offeredDurationsMinutes: [45],
      occupied: [],
    }], at(8));

    assert.deepEqual(slots.map((slot) => slot.startsAt.toISOString()), [
      at(9).toISOString(),
      at(9, 15).toISOString(),
    ]);
    assert.equal(slots.every((slot) => !slot.optimized), true);
});

test("treats pending and confirmed intervals as occupied", () => {
    const slots = generateSmartBookingSlots([{
      id: "block",
      offeringId: "offering",
      startsAt: at(9),
      endsAt: at(12),
      treatmentDurationMinutes: 60,
      offeredDurationsMinutes: [60],
      occupied: [{ startsAt: at(10), endsAt: at(11) }],
    }], at(8));

    assert.deepEqual(slots.map((slot) => slot.startsAt.toISOString()), [
      at(9).toISOString(),
      at(11).toISOString(),
    ]);
});
