-- AlterTable
ALTER TABLE "student_profile" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "student_profile_isPublished_publicSlug_idx" ON "student_profile"("isPublished", "publicSlug");
