/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `student_listing` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "student_listing" ADD COLUMN     "publicSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "student_listing_publicSlug_key" ON "student_listing"("publicSlug");
