import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAppointmentActionInput,
  parseAppointmentReviewInput,
} from "@/lib/appointments/appointment-input";

test("review requires an integer rating between one and five", () => {
  assert.equal(parseAppointmentReviewInput({ rating: 0 }).ok, false);
  assert.equal(parseAppointmentReviewInput({ rating: 6 }).ok, false);
  assert.equal(parseAppointmentReviewInput({ rating: 4.5 }).ok, false);
  assert.deepEqual(parseAppointmentReviewInput({ rating: 5, comment: " Foarte bine " }), {
    ok: true,
    data: { rating: 5, comment: "Foarte bine" },
  });
});

test("closing an appointment requires the student's review", () => {
  assert.equal(
    parseAppointmentActionInput({ action: "COMPLETE", expectedVersion: 1 }).ok,
    false,
  );
  assert.deepEqual(
    parseAppointmentActionInput({
      action: "NO_SHOW",
      expectedVersion: 2,
      rating: 2,
      comment: "Nu s-a prezentat.",
    }),
    {
      ok: true,
      data: {
        action: "NO_SHOW",
        expectedVersion: 2,
        reason: null,
        rating: 2,
        comment: "Nu s-a prezentat.",
      },
    },
  );
});
