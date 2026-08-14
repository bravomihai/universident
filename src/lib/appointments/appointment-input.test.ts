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
  assert.deepEqual(parseAppointmentReviewInput({ rating: 5, comment: " Foarte bine, mulțumesc. " }), {
    ok: true,
    data: { rating: 5, comment: "Foarte bine, mulțumesc." },
  });
});

test("review comment is optional but has at least ten characters when present", () => {
  assert.deepEqual(parseAppointmentReviewInput({ rating: 4, comment: "" }), {
    ok: true,
    data: { rating: 4, comment: null },
  });
  assert.equal(parseAppointmentReviewInput({ rating: 4, comment: "Scurt" }).ok, false);
  assert.deepEqual(parseAppointmentReviewInput({ rating: 4, comment: "Foarte bine" }), {
    ok: true,
    data: { rating: 4, comment: "Foarte bine" },
  });
  assert.deepEqual(
    parseAppointmentReviewInput({ rating: 4, comment: "O experiență foarte bună." }),
    {
      ok: true,
      data: { rating: 4, comment: "O experiență foarte bună." },
    },
  );
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
      comment: "Pacientul nu s-a prezentat.",
    }),
    {
      ok: true,
      data: {
        action: "NO_SHOW",
        expectedVersion: 2,
        reason: null,
        rating: 2,
        comment: "Pacientul nu s-a prezentat.",
      },
    },
  );
});
