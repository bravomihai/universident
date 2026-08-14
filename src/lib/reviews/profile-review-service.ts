import "server-only";

import { cache } from "react";

import { AppointmentReviewAuthorRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type ProfileOwnerRole = "PATIENT" | "STUDENT";

export type PublishedProfileReview = {
  id: string;
  rating: number;
  comment: string | null;
  publishedAt: Date;
  treatmentName: string;
  appointmentDate: Date;
  reviewerLabel: string;
  reviewerHref: string | null;
};

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
        author: { select: { name: true } },
        appointment: {
          select: {
            treatmentNameSnapshot: true,
            scheduledStartsAt: true,
            studentProfile: { select: { publicSlug: true } },
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
      if (!review.publishedAt) return [];
      const reviewerHref = targetRole === "PATIENT" && review.appointment.studentProfile.publicSlug
        ? `/studenti/${review.appointment.studentProfile.publicSlug}`
        : null;
      return [{
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        publishedAt: review.publishedAt,
        treatmentName: review.appointment.treatmentNameSnapshot,
        appointmentDate: review.appointment.scheduledStartsAt,
        reviewerLabel: targetRole === "STUDENT" ? "Pacient verificat" : review.author.name,
        reviewerHref,
      }];
    }),
  };
});
