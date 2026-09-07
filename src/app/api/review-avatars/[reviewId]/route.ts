import { AppointmentReviewAuthorRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewAvatarAccessWhere } from "@/lib/reviews/review-avatar-access";

type Props = { params: Promise<{ reviewId: string }> };
const reviewIdPattern = /^[a-z0-9_-]{10,64}$/i;
const imageSelect = { data: true, contentType: true, byteSize: true } as const;
const reviewSelect = {
  authorRole: true,
  author: {
    select: {
      patientProfile: { select: { profileImage: { select: imageSelect } } },
      studentProfile: { select: { profileImage: { select: imageSelect } } },
    },
  },
} as const;

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: Request, { params }: Props) {
  const { reviewId } = await params;
  if (!reviewIdPattern.test(reviewId)) return notFoundResponse();

  // Authorize the review before selecting image bytes. The private image route stays private.
  let review = await prisma.appointmentReview.findFirst({
    where: reviewAvatarAccessWhere(reviewId),
    select: reviewSelect,
  });

  if (!review) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) return notFoundResponse();
    review = await prisma.appointmentReview.findFirst({
      where: reviewAvatarAccessWhere(reviewId, session.user),
      select: reviewSelect,
    });
  }

  if (!review) return notFoundResponse();
  const image = review.authorRole === AppointmentReviewAuthorRole.PATIENT
    ? review.author.patientProfile?.profileImage
    : review.author.studentProfile?.profileImage;
  if (!image) return notFoundResponse();

  return new Response(Uint8Array.from(image.data).buffer, {
    headers: {
      // Re-check publication and profile visibility after every change, including withdrawal.
      "Cache-Control": "private, no-store",
      "Content-Type": image.contentType,
      "Content-Length": String(image.byteSize),
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      Vary: "Cookie",
    },
  });
}
