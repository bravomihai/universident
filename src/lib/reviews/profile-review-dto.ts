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
  reviewerImageUrl: string | null;
};

type ReviewImageReference = { updatedAt: Date };

type ProfileReviewSource = {
  id: string;
  rating: number;
  comment: string | null;
  publishedAt: Date | null;
  author: {
    name: string;
    patientProfile: { profileImage: ReviewImageReference | null } | null;
    studentProfile: {
      publicSlug: string | null;
      isPublished: boolean;
      profileImage: ReviewImageReference | null;
    } | null;
  };
  appointment: {
    treatmentNameSnapshot: string;
    scheduledStartsAt: Date;
  };
};

export function createPublishedProfileReview(
  review: ProfileReviewSource,
  targetRole: ProfileOwnerRole,
): PublishedProfileReview | null {
  if (!review.publishedAt) return null;

  const studentAuthor = targetRole === "PATIENT" ? review.author.studentProfile : null;
  const image = targetRole === "STUDENT"
    ? review.author.patientProfile?.profileImage
    : studentAuthor?.profileImage;

  // Patient identity is visible on the review, but no private profile URL or ID is exposed.
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    publishedAt: review.publishedAt,
    treatmentName: review.appointment.treatmentNameSnapshot,
    appointmentDate: review.appointment.scheduledStartsAt,
    reviewerLabel: review.author.name,
    reviewerHref: studentAuthor?.isPublished && studentAuthor.publicSlug
      ? `/studenti/${encodeURIComponent(studentAuthor.publicSlug)}`
      : null,
    reviewerImageUrl: image
      ? `/api/review-avatars/${encodeURIComponent(review.id)}?v=${image.updatedAt.getTime()}`
      : null,
  };
}
