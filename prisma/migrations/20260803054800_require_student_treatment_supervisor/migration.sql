/*
  Warnings:

  - Made the column `supervisor_id` on table `student_treatment_location` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "student_treatment_location" ALTER COLUMN "supervisor_id" SET NOT NULL;
