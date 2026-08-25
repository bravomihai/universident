import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAppointmentActionInput,
  parseAppointmentNotificationAcknowledgementInput,
  parseCreateAppointmentInput,
  parseAppointmentReviewInput,
} from "@/lib/appointments/appointment-input";

test("notification acknowledgement accepts bounded IDs and removes duplicates", () => {
  assert.deepEqual(
    parseAppointmentNotificationAcknowledgementInput({
      notificationIds: ["notification-1", "notification-1", " notification-2 "],
    }),
    {
      ok: true,
      data: { notificationIds: ["notification-1", "notification-2"] },
    },
  );
  assert.equal(
    parseAppointmentNotificationAcknowledgementInput({ notificationIds: "notification-1" }).ok,
    false,
  );
  assert.equal(
    parseAppointmentNotificationAcknowledgementInput({ notificationIds: [""] }).ok,
    false,
  );
  assert.equal(
    parseAppointmentNotificationAcknowledgementInput({
      notificationIds: Array.from({ length: 1001 }, (_, index) => `notification-${index}`),
    }).ok,
    false,
  );
});

test("booking requires a bounded idempotency key and a canonical start", () => {
  const base = {
    slotId: "slot-1",
    offeringId: "offering-1",
    startsAt: "2026-08-17T06:00:00.000Z",
    idempotencyKey: "12345678-1234-4234-8234-123456789012",
  };
  assert.equal(parseCreateAppointmentInput(base).ok, true);
  assert.equal(parseCreateAppointmentInput({ ...base, idempotencyKey: "short" }).ok, false);
  assert.equal(parseCreateAppointmentInput({ ...base, idempotencyKey: "x".repeat(65) }).ok, false);
  assert.equal(parseCreateAppointmentInput({ ...base, startsAt: "2026-08-17T06:00:01.000Z" }).ok, false);
  assert.equal(parseCreateAppointmentInput({ ...base, startsAt: "2026-08-17T06:07:00.000Z" }).ok, false);
});

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
