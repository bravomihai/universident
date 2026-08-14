import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { ProfileReviewData } from "@/lib/reviews/profile-review-service";

const reviewDateFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeZone: "Europe/Bucharest",
});

export function ProfileReviewList({
  data,
  title = "Recenzii",
}: {
  data: ProfileReviewData;
  title?: string;
}) {
  return (
    <section id="recenzii" aria-labelledby="profile-reviews-title" className="scroll-mt-24 space-y-4">
      <div>
        <h2 id="profile-reviews-title" className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sunt afișate numai recenziile verificate, publicate după ce au răspuns ambele persoane.
        </p>
      </div>
      {data.reviews.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {review.reviewerHref ? (
                      <Link href={review.reviewerHref} className="font-semibold hover:underline">
                        {review.reviewerLabel}
                      </Link>
                    ) : <p className="font-semibold">{review.reviewerLabel}</p>}
                    <p className="text-xs text-muted-foreground">
                      {review.treatmentName} · {reviewDateFormatter.format(review.appointmentDate)}
                    </p>
                  </div>
                  <span className="tracking-wider text-orange-500" aria-label={`${review.rating} din 5 stele`}>
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.comment ? <p className="whitespace-pre-line text-sm text-muted-foreground">{review.comment}</p> : <p className="text-sm text-muted-foreground">Rating fără comentariu.</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nu există încă recenzii publicate.</p>
      )}
    </section>
  );
}
