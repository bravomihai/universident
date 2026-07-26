/*
  Warnings:

  - Made the column `publicSlug` on table `student_listing` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "student_listing" ALTER COLUMN "publicSlug" SET NOT NULL;
