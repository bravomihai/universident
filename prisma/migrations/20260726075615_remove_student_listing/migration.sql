/*
  Warnings:

  - You are about to drop the `student_listing` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "student_listing" DROP CONSTRAINT "student_listing_cityId_fkey";

-- DropForeignKey
ALTER TABLE "student_listing" DROP CONSTRAINT "student_listing_studentProfileId_fkey";

-- DropForeignKey
ALTER TABLE "student_listing" DROP CONSTRAINT "student_listing_treatmentId_fkey";

-- DropTable
DROP TABLE "student_listing";

-- DropEnum
DROP TYPE "StudentListingStatus";
