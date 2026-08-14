import assert from "node:assert/strict";
import test from "node:test";

import { formatUnreadAppointmentNotifications } from "@/lib/appointments/appointment-notification-label";

test("appointment notification count uses correct Romanian grammar", () => {
  assert.equal(formatUnreadAppointmentNotifications(0), "Nicio notificare nouă");
  assert.equal(formatUnreadAppointmentNotifications(1), "O notificare nouă");
  assert.equal(formatUnreadAppointmentNotifications(3), "3 notificări noi");
});
