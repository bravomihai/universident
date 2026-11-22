import assert from "node:assert/strict";
import test from "node:test";

import { accountDeletionDigest, accountDeletionTransition } from "./account-deletion-policy";
import { appointmentIsArchived, appointmentNeedsAttention } from "../appointments/appointment-presentation";
import { chatState } from "../chat/policy";

const now = new Date("2026-11-22T12:00:00Z");
const future = new Date("2026-11-22T13:00:00Z");
const twoHoursAway = new Date("2026-11-22T14:00:00Z");

test("account deletion tokens are looked up by a SHA-256 digest", () => {
  const digest = accountDeletionDigest("one-time-secret");
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(accountDeletionDigest("one-time-secret"), digest);
  assert.notEqual(accountDeletionDigest("another-secret"), digest);
});

test("deletion closes pending requests according to role and respects expiry boundaries", () => {
  assert.equal(accountDeletionTransition("PENDING", future, null, "PATIENT", now)?.status, "CANCELLED_BY_PATIENT");
  assert.equal(accountDeletionTransition("PENDING", future, null, "STUDENT", now)?.status, "REJECTED");
  assert.equal(accountDeletionTransition("PENDING", now, null, "STUDENT", now)?.status, "EXPIRED");
  assert.equal(accountDeletionTransition("PENDING", future, now, "PATIENT", now)?.status, "EXPIRED");
});

test("deletion cancels future confirmations and closes started appointments without recording an outcome", () => {
  assert.deepEqual(accountDeletionTransition("CONFIRMED", future, null, "PATIENT", now), {
    status: "CANCELLED_BY_PATIENT", cancelledAt: now, isLateCancellation: true,
  });
  assert.deepEqual(accountDeletionTransition("CONFIRMED", twoHoursAway, null, "PATIENT", now), {
    status: "CANCELLED_BY_PATIENT", cancelledAt: now, isLateCancellation: false,
  });
  assert.equal(accountDeletionTransition("CONFIRMED", future, null, "STUDENT", now)?.status, "CANCELLED_BY_STUDENT");
  assert.deepEqual(accountDeletionTransition("CONFIRMED", now, null, "STUDENT", now), { status: "CONFIRMED" });
  assert.equal(accountDeletionTransition("COMPLETED", now, null, "PATIENT", now), null);
});

test("archived appointments with a deleted participant require no review and chats close immediately", () => {
  const appointment = { participantDeleted: true, status: "COMPLETED", scheduledStartsAt: now,
    scheduledEndsAt: now, confirmedAt: now, statusChangedAt: now, reviews: [] };
  for (const role of ["PATIENT", "STUDENT"] as const) {
    assert.equal(appointmentIsArchived(appointment, role), true);
    assert.equal(appointmentNeedsAttention(appointment, role, now), false);
  }
  const closedChat = { available: true, past: true, canSend: false, closesAt: null };
  assert.deepEqual(chatState(appointment, now), closedChat);
  assert.deepEqual(chatState({ ...appointment, status: "CONFIRMED" }, now), closedChat);
});
