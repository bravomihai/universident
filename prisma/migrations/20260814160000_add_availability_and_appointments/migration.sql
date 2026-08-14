-- CreateEnum
CREATE TYPE "StudentAvailabilityWeekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "StudentAvailabilityEndMode" AS ENUM ('NEVER', 'UNTIL', 'COUNT');

-- CreateEnum
CREATE TYPE "StudentAvailabilitySeriesStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudentAvailabilitySlotStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'SUPERSEDED', 'EXPIRED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_STUDENT', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentReviewAuthorRole" AS ENUM ('PATIENT', 'STUDENT');

-- Existing treatment/location assignments are prototype data. The underlying
-- treatments, locations, supervisors and profiles are intentionally retained.
DELETE FROM "student_treatment_location";

-- DropIndex
DROP INDEX "student_treatment_location_studentTreatmentId_studentLocati_key";

-- CreateTable
CREATE TABLE "patient_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileSlug" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_availability_series" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "studentTreatmentLocationId" TEXT NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Bucharest',
    "startsOn" DATE NOT NULL,
    "startMinuteOfDay" INTEGER NOT NULL,
    "weekdays" "StudentAvailabilityWeekday"[],
    "intervalWeeks" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "endMode" "StudentAvailabilityEndMode" NOT NULL,
    "endsOn" DATE,
    "occurrenceCount" INTEGER,
    "status" "StudentAvailabilitySeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "materializedThrough" DATE,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_availability_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_availability_slot" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "studentTreatmentLocationId" TEXT NOT NULL,
    "seriesId" TEXT,
    "sequenceNumber" INTEGER,
    "originalStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "StudentAvailabilitySlotStatus" NOT NULL DEFAULT 'ACTIVE',
    "isException" BOOLEAN NOT NULL DEFAULT false,
    "sourceRevision" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_availability_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "routeSlug" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "studentAvailabilitySlotId" TEXT NOT NULL,
    "scheduledStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "scheduledEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "patientAgeAtAppointment" INTEGER NOT NULL,
    "patientNote" TEXT,
    "patientNameSnapshot" VARCHAR(120) NOT NULL,
    "studentNameSnapshot" VARCHAR(120) NOT NULL,
    "treatmentNameSnapshot" VARCHAR(160) NOT NULL,
    "locationNameSnapshot" VARCHAR(160) NOT NULL,
    "locationAddressSnapshot" VARCHAR(240) NOT NULL,
    "supervisorNameSnapshot" VARCHAR(200) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "statusReason" VARCHAR(500),
    "statusReasonCode" VARCHAR(64),
    "statusChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangedByUserId" TEXT,
    "isLateCancellation" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "noShowAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_review" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "authorRole" "AppointmentReviewAuthorRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointment_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_profile_userId_key" ON "patient_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profile_profileSlug_key" ON "patient_profile"("profileSlug");

-- CreateIndex
CREATE INDEX "student_availability_series_owner_status_starts_idx" ON "student_availability_series"("studentProfileId", "status", "startsOn");

-- CreateIndex
CREATE INDEX "student_availability_series_association_status_starts_idx" ON "student_availability_series"("studentTreatmentLocationId", "status", "startsOn");

-- CreateIndex
CREATE INDEX "student_availability_series_status_materialized_idx" ON "student_availability_series"("status", "materializedThrough");

-- CreateIndex
CREATE UNIQUE INDEX "student_availability_series_id_owner_association_key" ON "student_availability_series"("id", "studentProfileId", "studentTreatmentLocationId");

-- CreateIndex
CREATE INDEX "student_availability_slot_owner_status_starts_idx" ON "student_availability_slot"("studentProfileId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "student_availability_slot_association_status_starts_idx" ON "student_availability_slot"("studentTreatmentLocationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "student_availability_slot_series_sequence_idx" ON "student_availability_slot"("seriesId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "student_availability_slot_series_original_start_key" ON "student_availability_slot"("seriesId", "originalStartsAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_routeSlug_key" ON "appointment"("routeSlug");

-- CreateIndex
CREATE INDEX "appointment_patientProfileId_status_scheduledStartsAt_idx" ON "appointment"("patientProfileId", "status", "scheduledStartsAt");

-- CreateIndex
CREATE INDEX "appointment_studentProfileId_status_scheduledStartsAt_idx" ON "appointment"("studentProfileId", "status", "scheduledStartsAt");

-- CreateIndex
CREATE INDEX "appointment_studentAvailabilitySlotId_status_idx" ON "appointment"("studentAvailabilitySlotId", "status");

-- CreateIndex
CREATE INDEX "appointment_review_targetUserId_publishedAt_idx" ON "appointment_review"("targetUserId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_review_appointmentId_authorUserId_key" ON "appointment_review"("appointmentId", "authorUserId");

-- CreateIndex
CREATE INDEX "student_treatment_location_studentTreatmentId_studentLocati_idx" ON "student_treatment_location"("studentTreatmentId", "studentLocationId");

-- AddForeignKey
ALTER TABLE "patient_profile" ADD CONSTRAINT "patient_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availability_series" ADD CONSTRAINT "student_availability_series_student_profile_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availability_series" ADD CONSTRAINT "student_availability_series_treatment_location_owner_fkey" FOREIGN KEY ("studentTreatmentLocationId", "studentProfileId") REFERENCES "student_treatment_location"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availability_slot" ADD CONSTRAINT "student_availability_slot_student_profile_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availability_slot" ADD CONSTRAINT "student_availability_slot_treatment_location_owner_fkey" FOREIGN KEY ("studentTreatmentLocationId", "studentProfileId") REFERENCES "student_treatment_location"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availability_slot" ADD CONSTRAINT "student_availability_slot_series_owner_fkey" FOREIGN KEY ("seriesId", "studentProfileId", "studentTreatmentLocationId") REFERENCES "student_availability_series"("id", "studentProfileId", "studentTreatmentLocationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_studentAvailabilitySlotId_fkey" FOREIGN KEY ("studentAvailabilitySlotId") REFERENCES "student_availability_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_statusChangedByUserId_fkey" FOREIGN KEY ("statusChangedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_review" ADD CONSTRAINT "appointment_review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_review" ADD CONSTRAINT "appointment_review_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_review" ADD CONSTRAINT "appointment_review_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve historical treatment/location/supervisor associations while allowing
-- only one active assignment for a treatment at a location.
CREATE UNIQUE INDEX "student_treatment_location_one_active_assignment_key"
ON "student_treatment_location" ("studentTreatmentId", "studentLocationId")
WHERE "isActive" = true AND "deletedAt" IS NULL;

-- GiST equality support is required by the temporal exclusion constraints.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "student_availability_series"
ADD CONSTRAINT "student_availability_series_rule_check"
CHECK (
    "timeZone" = 'Europe/Bucharest'
    AND "startMinuteOfDay" BETWEEN 0 AND 1439
    AND "intervalWeeks" IN (1, 2)
    AND "durationMinutes" BETWEEN 5 AND 480
    AND "revision" >= 1
    AND (
        "materializedThrough" IS NULL
        OR "materializedThrough" >= "startsOn"
    )
);

ALTER TABLE "student_availability_series"
ADD CONSTRAINT "student_availability_series_end_mode_check"
CHECK (
    (
        "endMode" = 'NEVER'
        AND "endsOn" IS NULL
        AND "occurrenceCount" IS NULL
    )
    OR (
        "endMode" = 'UNTIL'
        AND "endsOn" IS NOT NULL
        AND "endsOn" >= "startsOn"
        AND "occurrenceCount" IS NULL
    )
    OR (
        "endMode" = 'COUNT'
        AND "endsOn" IS NULL
        AND "occurrenceCount" IS NOT NULL
        AND "occurrenceCount" >= 1
    )
);

ALTER TABLE "student_availability_series"
ADD CONSTRAINT "student_availability_series_weekdays_check"
CHECK (
    cardinality("weekdays") BETWEEN 1 AND 7
    AND cardinality("weekdays") =
        (CASE WHEN "weekdays" @> ARRAY['MONDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['TUESDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['WEDNESDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['THURSDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['FRIDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['SATURDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END) +
        (CASE WHEN "weekdays" @> ARRAY['SUNDAY']::"StudentAvailabilityWeekday"[] THEN 1 ELSE 0 END)
);

ALTER TABLE "student_availability_slot"
ADD CONSTRAINT "student_availability_slot_interval_check"
CHECK ("endsAt" > "startsAt");

ALTER TABLE "student_availability_slot"
ADD CONSTRAINT "student_availability_slot_source_check"
CHECK (
    "version" >= 1
    AND (
        (
            "seriesId" IS NULL
            AND "sequenceNumber" IS NULL
            AND "sourceRevision" = 0
        )
        OR (
            "seriesId" IS NOT NULL
            AND "sequenceNumber" IS NOT NULL
            AND "sequenceNumber" >= 1
            AND "sourceRevision" >= 1
        )
    )
);

ALTER TABLE "student_availability_slot"
ADD CONSTRAINT "student_availability_slot_cancellation_check"
CHECK (
    ("status" = 'ACTIVE' AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
);

ALTER TABLE "student_availability_slot"
ADD CONSTRAINT "student_availability_slot_active_owner_time_excl"
EXCLUDE USING gist (
    "studentProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" = 'ACTIVE')
DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "student_availability_slot_active_owner_time_idx"
ON "student_availability_slot" ("studentProfileId", "startsAt", "endsAt")
WHERE "status" = 'ACTIVE';

CREATE INDEX "student_availability_slot_active_association_time_idx"
ON "student_availability_slot" ("studentTreatmentLocationId", "startsAt", "endsAt")
WHERE "status" = 'ACTIVE';

CREATE INDEX "student_availability_series_due_materialization_idx"
ON "student_availability_series" (COALESCE("materializedThrough", "startsOn"))
WHERE "status" = 'ACTIVE';

ALTER TABLE "appointment"
ADD CONSTRAINT "appointment_schedule_check"
CHECK (
    "scheduledEndsAt" > "scheduledStartsAt"
    AND "patientAgeAtAppointment" BETWEEN 18 AND 130
    AND "version" >= 1
    AND (
        "statusReason" IS NULL
        OR char_length(btrim("statusReason")) BETWEEN 20 AND 500
    )
    AND (
        "status" NOT IN (
            'REJECTED',
            'SUPERSEDED',
            'EXPIRED',
            'CANCELLED_BY_PATIENT',
            'CANCELLED_BY_STUDENT'
        )
        OR "statusReason" IS NOT NULL
    )
    AND (
        NOT "isLateCancellation"
        OR "status" = 'CANCELLED_BY_PATIENT'
    )
);

CREATE UNIQUE INDEX "appointment_one_active_per_slot_key"
ON "appointment" ("studentAvailabilitySlotId")
WHERE "status" IN ('PENDING', 'CONFIRMED');

ALTER TABLE "appointment"
ADD CONSTRAINT "appointment_patient_confirmed_time_excl"
EXCLUDE USING gist (
    "patientProfileId" WITH =,
    tstzrange("scheduledStartsAt", "scheduledEndsAt", '[)') WITH &&
)
WHERE ("status" = 'CONFIRMED')
DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "appointment_active_slot_time_idx"
ON "appointment" ("studentAvailabilitySlotId", "scheduledStartsAt")
WHERE "status" IN ('PENDING', 'CONFIRMED');

ALTER TABLE "appointment_review"
ADD CONSTRAINT "appointment_review_content_check"
CHECK (
    "rating" BETWEEN 1 AND 5
    AND (
        "comment" IS NULL
        OR char_length(btrim("comment")) BETWEEN 20 AND 1000
    )
);
