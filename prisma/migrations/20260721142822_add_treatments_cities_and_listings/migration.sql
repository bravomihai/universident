/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `student_profile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StudentListingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "student_profile" ADD COLUMN     "publicSlug" TEXT;

-- CreateTable
CREATE TABLE "treatment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_listing" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "clinicAddress" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "status" "StudentListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "student_listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treatment_slug_key" ON "treatment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "city_slug_key" ON "city"("slug");

-- CreateIndex
CREATE INDEX "student_listing_treatmentId_cityId_status_deletedAt_refresh_idx" ON "student_listing"("treatmentId", "cityId", "status", "deletedAt", "refreshedAt");

-- CreateIndex
CREATE INDEX "student_listing_studentProfileId_deletedAt_status_idx" ON "student_listing"("studentProfileId", "deletedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_publicSlug_key" ON "student_profile"("publicSlug");

-- CreateIndex
CREATE INDEX "student_listing_status_deletedAt_refreshedAt_idx"
ON "student_listing"("status", "deletedAt", "refreshedAt");

-- AddForeignKey
ALTER TABLE "student_listing" ADD CONSTRAINT "student_listing_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_listing" ADD CONSTRAINT "student_listing_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_listing" ADD CONSTRAINT "student_listing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "city"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "student_listing"
ADD CONSTRAINT "student_listing_available_range_check"
CHECK (
    "availableFrom" IS NULL
    OR "availableUntil" IS NULL
    OR "availableUntil" >= "availableFrom"
);

-- AddCheckConstraint
ALTER TABLE "student_listing"
ADD CONSTRAINT "student_listing_deleted_status_check"
CHECK (
    "deletedAt" IS NULL
    OR "status" = 'CLOSED'
);

-- AddCheckConstraint
ALTER TABLE "student_listing"
ADD CONSTRAINT "student_listing_open_published_check"
CHECK (
    "status" <> 'OPEN'
    OR "publishedAt" IS NOT NULL
);

-- AddCheckConstraint
ALTER TABLE "student_profile"
ADD CONSTRAINT "student_profile_published_slug_check"
CHECK (
    NOT "isPublished"
    OR "publicSlug" IS NOT NULL
);
