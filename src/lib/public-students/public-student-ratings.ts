import "server-only";

import type { RatingSummaryValue } from "@/components/reviews/rating-summary";
import type { Prisma } from "@/generated/prisma/client";

export const emptyPublicStudentRating: RatingSummaryValue = { averageRating: null, reviewCount: 0 };

export async function getPublicStudentRatings(
  db: Pick<Prisma.TransactionClient, "appointmentReview">,
  target: Prisma.AppointmentReviewWhereInput,
): Promise<Map<string, RatingSummaryValue>> {
  const ratings = await db.appointmentReview.groupBy({
    by: ["targetUserId"],
    where: { ...target, authorRole: "PATIENT", publishedAt: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(ratings.map((entry) => [entry.targetUserId, {
    averageRating: entry._avg.rating,
    reviewCount: entry._count.rating,
  }]));
}
