-- DropForeignKey
ALTER TABLE "student_verification_review" DROP CONSTRAINT "student_verification_review_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "student_verification_review" DROP CONSTRAINT "student_verification_review_studentProfileId_fkey";

-- DropIndex
DROP INDEX "student_profile_verificationStatus_submittedForVerification_idx";

-- AlterTable
ALTER TABLE "student_profile" DROP COLUMN "submittedForVerificationAt",
DROP COLUMN "verificationStatus";

-- DropTable
DROP TABLE "student_verification_review";

-- DropEnum
DROP TYPE "StudentVerificationDecision";

-- DropEnum
DROP TYPE "StudentVerificationStatus";
