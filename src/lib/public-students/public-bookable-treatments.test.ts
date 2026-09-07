import assert from "node:assert/strict";
import test from "node:test";

import { generatePublicBookingSlots } from "@/lib/availability/public-booking-slots";
import { publicBookingWindowEnd } from "@/lib/availability/public-booking-window";
import { getBookablePublicTreatments } from "./public-bookable-treatments";
import { publicStudentLocationKey } from "./public-student-location-key";

type Block = Parameters<typeof getBookablePublicTreatments>[0][number];
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 8, hour, minute));
const now = at(8);
const through = publicBookingWindowEnd(now);

function block(overrides: Partial<Block> = {}): Block {
  return {
    id: "block", startsAt: at(9), endsAt: at(13), appointments: [],
    studentLocation: {
      routeKey: "a123bc", name: "Clinica", address: "Adresă",
      city: { name: "Cluj-Napoca", slug: "cluj-napoca", isActive: true },
    },
    offerings: [{
      id: "offering", supervisor: { fullName: "Ana Popescu", academicTitle: null },
      studentTreatment: {
        durationMinutes: 90, description: null,
        treatment: { name: "Carii", slug: "carii", description: "Descriere", isActive: true },
      },
    }],
    ...overrides,
  };
}

test("profile location cards use the same 90-minute slicing as the public calendar", () => {
  const blocks = [block()];
  const treatments = getBookablePublicTreatments(blocks, now, through);
  const slots = generatePublicBookingSlots(blocks, "carii", now, through, now);
  assert.equal(treatments.length, 1);
  assert.equal(treatments[0].durationMinutes, 90);
  assert.equal(treatments[0].locations[0].routeKey, "a123bc");
  assert.deepEqual(slots.map((slot) => [slot.startsAt, slot.endsAt]), [
    [at(9), at(10, 30)], [at(10, 30), at(12)],
  ]);
  assert.equal(slots.every((slot) => slot.optimized), true);
});

test("occupied or too-short calendar blocks do not create profile location cards", () => {
  for (const unavailable of [
    block({ appointments: [{ scheduledStartsAt: at(9), scheduledEndsAt: at(13) }] }),
    block({ endsAt: at(10) }),
    block({ appointments: [{ scheduledStartsAt: at(10), scheduledEndsAt: at(12) }] }),
    block({ offerings: [] }),
  ]) {
    assert.deepEqual(getBookablePublicTreatments([unavailable], now, through), []);
    assert.deepEqual(generatePublicBookingSlots([unavailable], "carii", now, through, now), []);
  }
});

test("only the treatment that fits a location appears in the profile", () => {
  const base = block({ endsAt: at(10) });
  const shortOffering = {
    ...base.offerings[0], id: "consultation",
    studentTreatment: {
      ...base.offerings[0].studentTreatment, durationMinutes: 30,
      treatment: { name: "Consultație", slug: "consultatie", description: "Scurtă", isActive: true },
    },
  };
  const treatments = getBookablePublicTreatments([
    { ...base, offerings: [...base.offerings, shortOffering] },
  ], now, through);
  assert.deepEqual(treatments.map((item) => item.slug), ["consultatie"]);
});

test("full locations are omitted without hiding another bookable location", () => {
  const available = block();
  const full = block({
    id: "full",
    studentLocation: { ...available.studentLocation, routeKey: "d456ef" },
    appointments: [{ scheduledStartsAt: at(9), scheduledEndsAt: at(13) }],
  });
  const treatments = getBookablePublicTreatments([available, full], now, through);
  assert.deepEqual(treatments[0].locations.map((location) => location.routeKey), ["a123bc"]);
});

test("past blocks and availability outside the calendar window do not create cards", () => {
  const later = new Date(through.getTime() + 3_600_000);
  for (const unavailable of [
    block({ startsAt: at(6), endsAt: now }),
    block({ startsAt: through, endsAt: later }),
    block({ startsAt: later, endsAt: new Date(later.getTime() + 7_200_000) }),
  ]) {
    assert.deepEqual(getBookablePublicTreatments([unavailable], now, through), []);
  }
});

test("profile grouping preserves different supervisors but deduplicates repeated slots", () => {
  const first = block();
  const second = block({
    id: "second",
    offerings: [{ ...first.offerings[0], id: "second-offering", supervisor: { fullName: "Andrei Ionescu", academicTitle: null } }],
  });
  const locations = getBookablePublicTreatments([first, first, second], now, through)[0].locations;
  assert.equal(locations.length, 2);
  assert.equal(new Set(locations.map(publicStudentLocationKey)).size, 2);
});

test("inactive cities and treatments remain absent from public profile cards", () => {
  const base = block();
  assert.deepEqual(getBookablePublicTreatments([{
    ...base, studentLocation: { ...base.studentLocation, city: { ...base.studentLocation.city, isActive: false } },
  }], now, through), []);
  assert.deepEqual(getBookablePublicTreatments([{
    ...base, offerings: [{
      ...base.offerings[0], studentTreatment: {
        ...base.offerings[0].studentTreatment,
        treatment: { ...base.offerings[0].studentTreatment.treatment, isActive: false },
      },
    }],
  }], now, through), []);
});

test("calendar fallback start options remain available for a single fitting appointment", () => {
  const blocks = [block({ endsAt: at(10, 50) })];
  assert.equal(getBookablePublicTreatments(blocks, now, through).length, 1);
  const slots = generatePublicBookingSlots(blocks, "carii", now, through, now);
  assert.deepEqual(slots.map((slot) => slot.startsAt), [at(9), at(9, 15)]);
  assert.equal(slots.every((slot) => !slot.optimized), true);
  assert.deepEqual(generatePublicBookingSlots(blocks, "another-treatment", now, through, now), []);
});
