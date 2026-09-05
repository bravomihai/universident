-- AlterTable
ALTER TABLE "student_profile"
ADD COLUMN "lastRefreshedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "student_profile_image" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(32) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_profile_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_image_studentProfileId_key"
ON "student_profile_image"("studentProfileId");

-- AddForeignKey
ALTER TABLE "student_profile_image"
ADD CONSTRAINT "student_profile_image_studentProfileId_fkey"
FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
