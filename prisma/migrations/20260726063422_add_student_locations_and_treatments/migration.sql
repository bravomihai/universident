-- CreateTable
CREATE TABLE "student_location" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "details" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_treatment" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_treatment_location" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "studentTreatmentId" TEXT NOT NULL,
    "studentLocationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_treatment_location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_location_studentProfileId_deletedAt_isActive_idx" ON "student_location"("studentProfileId", "deletedAt", "isActive");

-- CreateIndex
CREATE INDEX "student_location_cityId_deletedAt_isActive_studentProfileId_idx" ON "student_location"("cityId", "deletedAt", "isActive", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "student_location_id_studentProfileId_key" ON "student_location"("id", "studentProfileId");

-- CreateIndex
CREATE INDEX "student_treatment_studentProfileId_deletedAt_isActive_idx" ON "student_treatment"("studentProfileId", "deletedAt", "isActive");

-- CreateIndex
CREATE INDEX "student_treatment_treatmentId_deletedAt_isActive_studentPro_idx" ON "student_treatment"("treatmentId", "deletedAt", "isActive", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "student_treatment_studentProfileId_treatmentId_key" ON "student_treatment"("studentProfileId", "treatmentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_treatment_id_studentProfileId_key" ON "student_treatment"("id", "studentProfileId");

-- CreateIndex
CREATE INDEX "student_treatment_location_studentProfileId_deletedAt_isAct_idx" ON "student_treatment_location"("studentProfileId", "deletedAt", "isActive");

-- CreateIndex
CREATE INDEX "student_treatment_location_studentTreatmentId_deletedAt_isA_idx" ON "student_treatment_location"("studentTreatmentId", "deletedAt", "isActive");

-- CreateIndex
CREATE INDEX "student_treatment_location_studentLocationId_deletedAt_isAc_idx" ON "student_treatment_location"("studentLocationId", "deletedAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "student_treatment_location_studentTreatmentId_studentLocati_key" ON "student_treatment_location"("studentTreatmentId", "studentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "student_treatment_location_id_studentProfileId_key" ON "student_treatment_location"("id", "studentProfileId");

-- AddForeignKey
ALTER TABLE "student_location" ADD CONSTRAINT "student_location_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_location" ADD CONSTRAINT "student_location_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "city"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_treatment" ADD CONSTRAINT "student_treatment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_treatment" ADD CONSTRAINT "student_treatment_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_treatment_location" ADD CONSTRAINT "student_treatment_location_treatment_owner_fkey" FOREIGN KEY ("studentTreatmentId", "studentProfileId") REFERENCES "student_treatment"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_treatment_location" ADD CONSTRAINT "student_treatment_location_location_owner_fkey" FOREIGN KEY ("studentLocationId", "studentProfileId") REFERENCES "student_location"("id", "studentProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate student location content and archive state
ALTER TABLE "student_location"
ADD CONSTRAINT "student_location_content_check"
CHECK (
    char_length(btrim("name")) >= 2
    AND char_length(btrim("address")) >= 5
);

ALTER TABLE "student_location"
ADD CONSTRAINT "student_location_archive_state_check"
CHECK (
    "deletedAt" IS NULL
    OR "isActive" = false
);

-- Validate student treatment duration and archive state
ALTER TABLE "student_treatment"
ADD CONSTRAINT "student_treatment_duration_check"
CHECK (
    "durationMinutes" BETWEEN 5 AND 480
);

ALTER TABLE "student_treatment"
ADD CONSTRAINT "student_treatment_archive_state_check"
CHECK (
    "deletedAt" IS NULL
    OR "isActive" = false
);

-- Validate treatment-location archive state
ALTER TABLE "student_treatment_location"
ADD CONSTRAINT "student_treatment_location_archive_state_check"
CHECK (
    "deletedAt" IS NULL
    OR "isActive" = false
);