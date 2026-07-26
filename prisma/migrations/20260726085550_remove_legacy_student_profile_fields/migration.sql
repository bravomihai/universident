/*
  Warnings:

  - You are about to drop the column `city` on the `student_profile` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `student_profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "student_profile" DROP COLUMN "city",
DROP COLUMN "isPublished";
