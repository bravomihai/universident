import type { Prisma } from "@/generated/prisma/client";
import { AppointmentReviewAuthorRole, UserRole } from "@/generated/prisma/enums";
import { patientProfileAccessWhere } from "@/lib/patient/patient-profile-access";

type ReviewAvatarViewer = {
  id: string;
  role: UserRole;
  emailVerified: boolean;
};

export function reviewAvatarAccessWhere(
  reviewId: string,
  viewer: ReviewAvatarViewer | null = null,
): Prisma.AppointmentReviewWhereInput {
  const visibleTargets: Prisma.AppointmentReviewWhereInput[] = [{
    authorRole: AppointmentReviewAuthorRole.PATIENT,
    target: {
      role: UserRole.STUDENT,
      emailVerified: true,
      studentProfile: {
        isPublished: true,
        publicSlug: { not: null },
        university: { not: "" },
        studyYear: { gte: 1, lte: 6 },
      },
    },
  }];

  if (viewer?.emailVerified && viewer.id) {
    if (viewer.role === UserRole.STUDENT) {
      // Students can also see received reviews in their own unpublished profile.
      visibleTargets.push({
        authorRole: AppointmentReviewAuthorRole.PATIENT,
        targetUserId: viewer.id,
      });
    }

    if (viewer.role === UserRole.PATIENT || viewer.role === UserRole.STUDENT) {
      // An avatar must never reveal a review on an inaccessible private patient profile.
      visibleTargets.push({
        authorRole: AppointmentReviewAuthorRole.STUDENT,
        target: { patientProfile: patientProfileAccessWhere(viewer) },
      });
    }
  }

  return { id: reviewId, publishedAt: { not: null }, OR: visibleTargets };
}
