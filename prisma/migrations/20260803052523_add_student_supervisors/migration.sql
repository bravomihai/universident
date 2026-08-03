-- AlterTable
ALTER TABLE "student_treatment_location" ADD COLUMN     "supervisor_id" TEXT;

-- CreateTable
CREATE TABLE "student_supervisor" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "academicTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_supervisor_studentProfileId_deletedAt_isActive_idx" ON "student_supervisor"("studentProfileId", "deletedAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "student_supervisor_id_studentProfileId_key" ON "student_supervisor"("id", "studentProfileId");

-- CreateIndex
CREATE INDEX "student_treatment_location_supervisor_id_deletedAt_isActive_idx" ON "student_treatment_location"("supervisor_id", "deletedAt", "isActive");

-- Validate supervisor content and archive state
ALTER TABLE "student_supervisor"
ADD CONSTRAINT "student_supervisor_content_check"
CHECK (
    char_length(btrim("fullName")) BETWEEN 2 AND 120
    AND (
        "academicTitle" IS NULL
        OR char_length(btrim("academicTitle")) BETWEEN 2 AND 80
    )
);

ALTER TABLE "student_supervisor"
ADD CONSTRAINT "student_supervisor_archive_state_check"
CHECK (
    "deletedAt" IS NULL
    OR "isActive" = false
);

-- AddForeignKey
ALTER TABLE "student_supervisor" ADD CONSTRAINT "student_supervisor_student_profile_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_treatment_location" ADD CONSTRAINT "student_treatment_location_supervisor_owner_fkey" FOREIGN KEY ("supervisor_id", "studentProfileId") REFERENCES "student_supervisor"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;
