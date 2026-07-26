-- CreateEnum
CREATE TYPE "StudentVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StudentVerificationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "student_profile" ADD COLUMN     "submittedForVerificationAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "StudentVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';

-- CreateTable
CREATE TABLE "student_verification_review" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "StudentVerificationDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_verification_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_verification_review_studentProfileId_createdAt_idx" ON "student_verification_review"("studentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "student_verification_review_reviewerId_createdAt_idx" ON "student_verification_review"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "student_profile_verificationStatus_submittedForVerification_idx" ON "student_profile"("verificationStatus", "submittedForVerificationAt");

-- AddForeignKey
ALTER TABLE "student_verification_review" ADD CONSTRAINT "student_verification_review_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_verification_review" ADD CONSTRAINT "student_verification_review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Require a meaningful reason for rejections and validate optional reasons
ALTER TABLE "student_verification_review"
ADD CONSTRAINT "student_verification_review_reason_check"
CHECK (
    (
        "decision" = 'REJECTED'
        AND "reason" IS NOT NULL
        AND char_length(btrim("reason")) >= 20
    )
    OR
    (
        "decision" = 'APPROVED'
        AND (
            "reason" IS NULL
            OR char_length(btrim("reason")) >= 20
        )
    )
);