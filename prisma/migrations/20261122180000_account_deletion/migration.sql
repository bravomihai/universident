ALTER TABLE "appointment"
    ADD COLUMN "participantDeleted" BOOLEAN NOT NULL DEFAULT false,
    ALTER COLUMN "patientAgeAtAppointment" DROP NOT NULL,
    ADD CONSTRAINT "appointment_age_required_unless_account_deleted"
        CHECK ("patientAgeAtAppointment" IS NOT NULL OR "participantDeleted");
