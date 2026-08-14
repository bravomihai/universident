CREATE TABLE "appointment_notification" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "eventType" VARCHAR(64) NOT NULL,
  "readAt" TIMESTAMP(3) WITH TIME ZONE,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "appointment_notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_notification_recipientUserId_readAt_createdAt_idx"
  ON "appointment_notification"("recipientUserId", "readAt", "createdAt");

CREATE INDEX "appointment_notification_appointmentId_recipientUserId_idx"
  ON "appointment_notification"("appointmentId", "recipientUserId");

ALTER TABLE "appointment_notification"
  ADD CONSTRAINT "appointment_notification_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointment_notification"
  ADD CONSTRAINT "appointment_notification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
