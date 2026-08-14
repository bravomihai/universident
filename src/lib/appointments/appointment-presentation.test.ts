import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentIsArchived,
  appointmentNeedsAttention,
  orderAppointmentsForRole,
} from "@/lib/appointments/appointment-presentation";

const now = new Date("2026-08-14T12:00:00.000Z");
const base = {
  scheduledStartsAt: "2026-08-14T10:00:00.000Z",
  scheduledEndsAt: "2026-08-14T11:00:00.000Z",
  reviews: [] as Array<{ authorRole: string }>,
};

test("a past confirmed appointment stays active and alerts the student", () => {
  const appointment = { ...base, status: "CONFIRMED" };
  assert.equal(appointmentNeedsAttention(appointment, "STUDENT", now), true);
  assert.equal(appointmentIsArchived(appointment, "STUDENT"), false);
  assert.equal(appointmentNeedsAttention(appointment, "PATIENT", now), false);
});

test("a completed appointment archives separately after each review", () => {
  const appointment = {
    ...base,
    status: "COMPLETED",
    reviews: [{ authorRole: "STUDENT" }],
  };
  assert.equal(appointmentIsArchived(appointment, "STUDENT"), true);
  assert.equal(appointmentIsArchived(appointment, "PATIENT"), false);
  assert.equal(appointmentNeedsAttention(appointment, "PATIENT", now), true);
});

test("appointments requiring action are ordered before the others", () => {
  const normal = { ...base, status: "PENDING", scheduledStartsAt: "2026-08-15T10:00:00.000Z" };
  const attention = { ...base, status: "CONFIRMED" };
  assert.equal(orderAppointmentsForRole([normal, attention], "STUDENT", now)[0], attention);
});
