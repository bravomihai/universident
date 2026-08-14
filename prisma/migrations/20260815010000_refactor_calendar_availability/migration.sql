-- Availability is now modeled as a location-bound block with multiple
-- treatment/supervisor offerings. Appointments consume subintervals.

ALTER TABLE "student_availability_slot"
  DROP CONSTRAINT IF EXISTS "student_availability_slot_series_owner_fkey",
  DROP CONSTRAINT IF EXISTS "student_availability_slot_treatment_location_owner_fkey";

ALTER TABLE "student_availability_series"
  DROP CONSTRAINT IF EXISTS "student_availability_series_treatment_location_owner_fkey";

DROP INDEX IF EXISTS "appointment_one_active_per_slot_key";
DROP INDEX IF EXISTS "student_availability_slot_active_association_time_idx";
DROP INDEX IF EXISTS "student_availability_series_id_owner_association_key";
DROP INDEX IF EXISTS "student_availability_series_association_status_starts_idx";
DROP INDEX IF EXISTS "student_availability_slot_association_status_starts_idx";

ALTER TABLE "student_location"
  DROP CONSTRAINT IF EXISTS "student_location_archive_state_check";
ALTER TABLE "student_treatment"
  DROP CONSTRAINT IF EXISTS "student_treatment_archive_state_check";
ALTER TABLE "student_supervisor"
  DROP CONSTRAINT IF EXISTS "student_supervisor_archive_state_check";

ALTER TABLE "student_treatment"
  DROP CONSTRAINT IF EXISTS "student_treatment_duration_check",
  ADD CONSTRAINT "student_treatment_duration_check"
  CHECK (
    "durationMinutes" BETWEEN 15 AND 480
    AND "durationMinutes" % 15 = 0
  );

ALTER TABLE "student_availability_series"
  DROP CONSTRAINT IF EXISTS "student_availability_series_rule_check",
  ADD CONSTRAINT "student_availability_series_rule_check"
  CHECK (
    "timeZone" = 'Europe/Bucharest'
    AND "startMinuteOfDay" BETWEEN 0 AND 1439
    AND "intervalWeeks" IN (1, 2)
    AND "durationMinutes" BETWEEN 15 AND 720
    AND "durationMinutes" % 15 = 0
    AND "startMinuteOfDay" + "durationMinutes" <= 1440
    AND "revision" >= 1
    AND (
      "materializedThrough" IS NULL
      OR "materializedThrough" >= "startsOn"
    )
  );

ALTER TABLE "student_location" DROP COLUMN "isActive";
ALTER TABLE "student_treatment" DROP COLUMN "isActive";
ALTER TABLE "student_supervisor" DROP COLUMN "isActive";

ALTER TABLE "student_availability_series"
  ADD COLUMN "studentLocationId" TEXT NOT NULL,
  DROP COLUMN "studentTreatmentLocationId";

ALTER TABLE "student_availability_slot"
  ADD COLUMN "studentLocationId" TEXT NOT NULL,
  DROP COLUMN "studentTreatmentLocationId";

CREATE TABLE "student_availability_series_offering" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "studentTreatmentId" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_availability_series_offering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_availability_slot_offering" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "studentTreatmentId" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "removedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_availability_slot_offering_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointment"
  ADD COLUMN "studentAvailabilitySlotOfferingId" TEXT NOT NULL;

CREATE UNIQUE INDEX "student_availability_series_id_studentProfileId_key"
  ON "student_availability_series"("id", "studentProfileId");
CREATE UNIQUE INDEX "student_availability_series_id_owner_location_key"
  ON "student_availability_series"("id", "studentProfileId", "studentLocationId");
CREATE UNIQUE INDEX "student_availability_slot_id_studentProfileId_key"
  ON "student_availability_slot"("id", "studentProfileId");
CREATE UNIQUE INDEX "student_availability_series_offering_series_treatment_key"
  ON "student_availability_series_offering"("seriesId", "studentTreatmentId");
CREATE UNIQUE INDEX "student_availability_slot_offering_id_slotId_key"
  ON "student_availability_slot_offering"("id", "slotId");
CREATE UNIQUE INDEX "student_availability_slot_offering_active_treatment_key"
  ON "student_availability_slot_offering"("slotId", "studentTreatmentId")
  WHERE "removedAt" IS NULL;

CREATE INDEX "student_location_studentProfileId_deletedAt_idx"
  ON "student_location"("studentProfileId", "deletedAt");
CREATE INDEX "student_location_cityId_deletedAt_studentProfileId_idx"
  ON "student_location"("cityId", "deletedAt", "studentProfileId");
CREATE INDEX "student_treatment_studentProfileId_deletedAt_idx"
  ON "student_treatment"("studentProfileId", "deletedAt");
CREATE INDEX "student_treatment_treatmentId_deletedAt_studentProfileId_idx"
  ON "student_treatment"("treatmentId", "deletedAt", "studentProfileId");
CREATE INDEX "student_supervisor_studentProfileId_deletedAt_idx"
  ON "student_supervisor"("studentProfileId", "deletedAt");
CREATE INDEX "student_availability_series_location_status_starts_idx"
  ON "student_availability_series"("studentLocationId", "status", "startsOn");
CREATE INDEX "student_availability_slot_location_status_starts_idx"
  ON "student_availability_slot"("studentLocationId", "status", "startsAt");
CREATE INDEX "student_availability_series_offering_treatment_series_idx"
  ON "student_availability_series_offering"("studentTreatmentId", "seriesId");
CREATE INDEX "student_availability_series_offering_supervisor_series_idx"
  ON "student_availability_series_offering"("supervisorId", "seriesId");
CREATE INDEX "student_availability_slot_offering_slot_treatment_removed_idx"
  ON "student_availability_slot_offering"("slotId", "studentTreatmentId", "removedAt");
CREATE INDEX "student_availability_slot_offering_treatment_slot_idx"
  ON "student_availability_slot_offering"("studentTreatmentId", "slotId");
CREATE INDEX "student_availability_slot_offering_supervisor_slot_idx"
  ON "student_availability_slot_offering"("supervisorId", "slotId");
CREATE INDEX "appointment_studentAvailabilitySlotOfferingId_status_idx"
  ON "appointment"("studentAvailabilitySlotOfferingId", "status");

ALTER TABLE "student_availability_series"
  ADD CONSTRAINT "student_availability_series_location_owner_fkey"
  FOREIGN KEY ("studentLocationId", "studentProfileId")
  REFERENCES "student_location"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_availability_slot"
  ADD CONSTRAINT "student_availability_slot_location_owner_fkey"
  FOREIGN KEY ("studentLocationId", "studentProfileId")
  REFERENCES "student_location"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_availability_slot_series_owner_fkey"
  FOREIGN KEY ("seriesId", "studentProfileId", "studentLocationId")
  REFERENCES "student_availability_series"("id", "studentProfileId", "studentLocationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_availability_series_offering"
  ADD CONSTRAINT "availability_series_offering_series_owner_fkey"
  FOREIGN KEY ("seriesId", "studentProfileId")
  REFERENCES "student_availability_series"("id", "studentProfileId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "availability_series_offering_treatment_owner_fkey"
  FOREIGN KEY ("studentTreatmentId", "studentProfileId")
  REFERENCES "student_treatment"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "availability_series_offering_supervisor_owner_fkey"
  FOREIGN KEY ("supervisorId", "studentProfileId")
  REFERENCES "student_supervisor"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_availability_slot_offering"
  ADD CONSTRAINT "availability_slot_offering_slot_owner_fkey"
  FOREIGN KEY ("slotId", "studentProfileId")
  REFERENCES "student_availability_slot"("id", "studentProfileId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "availability_slot_offering_treatment_owner_fkey"
  FOREIGN KEY ("studentTreatmentId", "studentProfileId")
  REFERENCES "student_treatment"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "availability_slot_offering_supervisor_owner_fkey"
  FOREIGN KEY ("supervisorId", "studentProfileId")
  REFERENCES "student_supervisor"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_availability_offering_fkey"
  FOREIGN KEY ("studentAvailabilitySlotOfferingId", "studentAvailabilitySlotId")
  REFERENCES "student_availability_slot_offering"("id", "slotId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointment"
ADD CONSTRAINT "appointment_student_active_time_excl"
EXCLUDE USING gist (
  "studentProfileId" WITH =,
  tstzrange("scheduledStartsAt", "scheduledEndsAt", '[)') WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED'))
DEFERRABLE INITIALLY IMMEDIATE;

DROP TABLE "student_treatment_location";
