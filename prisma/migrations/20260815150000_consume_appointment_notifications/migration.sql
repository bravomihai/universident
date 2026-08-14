DELETE FROM "appointment_notification"
WHERE "readAt" IS NOT NULL;

DROP INDEX "appointment_notification_recipientUserId_readAt_createdAt_idx";

ALTER TABLE "appointment_notification"
  DROP COLUMN "readAt";

CREATE INDEX "appointment_notification_recipientUserId_createdAt_idx"
  ON "appointment_notification"("recipientUserId", "createdAt");
