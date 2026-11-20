BEGIN;

ALTER TABLE "appointment" ADD COLUMN "studentUniversitySnapshot" TEXT;

UPDATE "appointment" AS appointment
SET "studentUniversitySnapshot" = profile."university"
FROM "student_profile" AS profile
WHERE profile."id" = appointment."studentProfileId";

ALTER TABLE "appointment"
  ALTER COLUMN "studentUniversitySnapshot" SET NOT NULL,
  DROP COLUMN "supervisorNameSnapshot";

ALTER TABLE "student_availability_series_offering" DROP COLUMN "supervisorId";
ALTER TABLE "student_availability_slot_offering" DROP COLUMN "supervisorId";
DROP TABLE "student_supervisor";

COMMIT;
