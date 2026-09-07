import "server-only";

import { cache } from "react";

import { AppointmentReviewAuthorRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createPublishedProfileReview,
  type ProfileOwnerRole,
  type PublishedProfileReview,
} from "@/lib/reviews/profile-review-dto";

export type { ProfileOwnerRole, PublishedProfileReview } from "@/lib/reviews/profile-review-dto";

export type ProfileReviewData = {
  summary: {
    averageRating: number | null;
    reviewCount: number;
  };
  reviews: PublishedProfileReview[];
};

export const getPublishedProfileReviews = cache(async (
  targetUserId: string,
  targetRole: ProfileOwnerRole,
): Promise<ProfileReviewData> => {
  const authorRole = targetRole === "STUDENT"
    ? AppointmentReviewAuthorRole.PATIENT
    : AppointmentReviewAuthorRole.STUDENT;
  const where = {
    targetUserId,
    authorRole,
    publishedAt: { not: null },
  } as const;
  const [aggregate, reviews] = await Promise.all([
    prisma.appointmentReview.aggregate({
      where,
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.appointmentReview.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        publishedAt: true,
        author: {
          select: {
            name: true,
            patientProfile: { select: { profileImage: { select: { updatedAt: true } } } },
            studentProfile: {
              select: {
                publicSlug: true,
                isPublished: true,
                profileImage: { select: { updatedAt: true } },
              },
            },
          },
        },
        appointment: {
          select: {
            treatmentNameSnapshot: true,
            scheduledStartsAt: true,
          },
        },
      },
    }),
  ]);

  return {
    summary: {
      averageRating: aggregate._avg.rating,
      reviewCount: aggregate._count.rating,
    },
    reviews: reviews.flatMap((review) => {
      const publishedReview = createPublishedProfileReview(review, targetRole);
      return publishedReview ? [publishedReview] : [];
    }),
  };
});
