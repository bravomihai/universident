BEGIN;

CREATE TYPE "AppointmentEmailKind" AS ENUM ('CONFIRMED', 'REJECTED', 'STUDENT_REVIEW', 'PATIENT_REVIEW');
CREATE TYPE "AppointmentEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "appointment_email" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" "AppointmentEmailKind" NOT NULL,
    "status" "AppointmentEmailStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMPTZ(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "recipientEmail" TEXT,
    "fromEmail" TEXT,
    "appointmentsUrl" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "resendEmailId" TEXT,
    "lastErrorCode" VARCHAR(64),
    CONSTRAINT "appointment_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_email_appointmentId_kind_key" ON "appointment_email"("appointmentId", "kind");
CREATE INDEX "appointment_email_status_dueAt_idx" ON "appointment_email"("status", "dueAt");

ALTER TABLE "appointment_email"
    ADD CONSTRAINT "appointment_email_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_email_batch" ADD COLUMN "resendEmailId" TEXT;

-- Schedule reminders for existing appointments that have yet to end.
INSERT INTO "appointment_email" ("id", "appointmentId", "kind", "dueAt")
SELECT 'student-review-' || "id", "id", 'STUDENT_REVIEW', "scheduledEndsAt"
FROM "appointment"
WHERE "status" = 'CONFIRMED' AND "scheduledEndsAt" > CURRENT_TIMESTAMP;

COMMIT;
