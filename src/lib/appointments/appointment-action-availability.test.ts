import assert from "node:assert/strict";
import test from "node:test";
import { appointmentActionAvailability } from "./appointment-action-availability";

const now = new Date("2026-09-07T10:00:00Z");
const base = { startsAt: "2026-09-08T10:00:00Z", endsAt: "2026-09-08T11:00:00Z", reviewedByActor: false };

test("list mode permits only supported cancellations and hides confirmation, rejection and review controls", () => {
  for (const role of ["PATIENT", "STUDENT"] as const) {
    for (const status of ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "REJECTED", "EXPIRED", "SUPERSEDED", "CANCELLED_BY_PATIENT", "CANCELLED_BY_STUDENT"]) {
      const actions = appointmentActionAvailability({ ...base, status, role, mode: "cancel-only" }, now);
      assert.equal(actions.studentPending, false);
      assert.equal(actions.studentCanFinish, false);
      assert.equal(actions.reviewNeeded, false);
      assert.equal(actions.patientCanCancel, role === "PATIENT" && ["PENDING", "CONFIRMED"].includes(status));
      assert.equal(actions.studentCanCancel, role === "STUDENT" && status === "CONFIRMED");
    }
  }
});

test("both roles lose the cancel action exactly at the appointment start", () => {
  for (const role of ["PATIENT", "STUDENT"] as const) {
    for (const mode of ["all", "cancel-only"] as const) {
      const actions = appointmentActionAvailability({ ...base, startsAt: now.toISOString(), status: "CONFIRMED", role, mode }, now);
      assert.equal(actions.studentCanCancel, false);
      assert.equal(actions.patientCanCancel, false);
    }
  }
});

test("details retain student confirmation/rejection and completion actions", () => {
  assert.equal(appointmentActionAvailability({ ...base, status: "PENDING", role: "STUDENT" }, now).studentPending, true);
  assert.equal(appointmentActionAvailability({ ...base, status: "CONFIRMED", role: "STUDENT", startsAt: "2026-09-07T09:00:00Z", endsAt: now.toISOString() }, now).studentCanFinish, true);
});

test("details preserve role-specific review and already-reviewed rules", () => {
  assert.equal(appointmentActionAvailability({ ...base, status: "COMPLETED", role: "PATIENT" }, now).reviewNeeded, true);
  assert.equal(appointmentActionAvailability({ ...base, status: "COMPLETED", role: "PATIENT", reviewedByActor: true }, now).reviewNeeded, false);
  assert.equal(appointmentActionAvailability({ ...base, status: "NO_SHOW", role: "PATIENT" }, now).reviewNeeded, false);
  assert.equal(appointmentActionAvailability({ ...base, status: "NO_SHOW", role: "STUDENT" }, now).reviewNeeded, true);
});
