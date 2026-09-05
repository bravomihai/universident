-- CreateTable
CREATE TABLE "patient_profile_image" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(32) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_profile_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_profile_image_patientProfileId_key"
ON "patient_profile_image"("patientProfileId");

-- AddForeignKey
ALTER TABLE "patient_profile_image"
ADD CONSTRAINT "patient_profile_image_patientProfileId_fkey"
FOREIGN KEY ("patientProfileId") REFERENCES "patient_profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
