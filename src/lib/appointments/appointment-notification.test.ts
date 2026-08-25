import assert from "node:assert/strict";
import test from "node:test";

import { appointmentNotificationAcknowledgementWhere } from "@/lib/appointments/appointment-notification";

test("notification acknowledgement is scoped to the signed-in recipient", () => {
  assert.deepEqual(
    appointmentNotificationAcknowledgementWhere("user-1", [
      "notification-1",
      "notification-1",
      "notification-2",
    ]),
    {
      recipientUserId: "user-1",
      id: { in: ["notification-1", "notification-2"] },
    },
  );
});
