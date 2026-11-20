import { Star } from "lucide-react";

import Link from "@/components/navigation/app-link";

import { Button } from "@/components/ui/button";
import { completedAppointmentCountLabel } from "@/lib/public-students/public-student-directory-order";
import { cn } from "@/lib/utils";

export type RatingSummaryValue = {
  averageRating: number | null;
  reviewCount: number;
};

export function RatingStars({
  averageRating,
  reviewCount,
  completedAppointmentsCount = null,
  showReviewCount = true,
  className,
}: RatingSummaryValue & {
  completedAppointmentsCount?: number | null;
  showReviewCount?: boolean;
  className?: string;
}) {
  const halfStars = Math.round((averageRating ?? 0) * 2);
  const averageLabel = reviewCount > 0 ? averageRating?.toFixed(1) : undefined;
  const reviewLabel = reviewCount === 1 ? "1 recenzie" : `${reviewCount} recenzii`;
  const ratingLabel = showReviewCount
    ? [averageLabel, reviewLabel].filter(Boolean).join(" · ")
    : averageLabel;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span
        role="img"
        className="inline-flex shrink-0 items-center gap-0.5 text-lg text-orange-500"
        aria-label={averageLabel ? `${averageLabel} din 5 stele` : "Fără recenzii"}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const fill = halfStars - index * 2;
          return (
            <span key={index} className="relative size-[1em]" aria-hidden="true">
              <Star className={cn("size-full", fill >= 2 && "fill-current")} />
              {fill === 1 ? (
                <Star className="absolute inset-0 size-full fill-current [clip-path:inset(0_50%_0_0)]" />
              ) : null}
            </span>
          );
        })}
      </span>
      {ratingLabel || completedAppointmentsCount !== null ? (
        <span className="text-sm font-medium">
          {ratingLabel}
          {completedAppointmentsCount !== null ? (
            <span>{ratingLabel ? " ·\u00a0" : null}{completedAppointmentCountLabel(completedAppointmentsCount)}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function RatingSummaryLink({
  summary,
  completedAppointmentsCount,
  showReviewCount,
  href,
  className,
}: {
  summary: RatingSummaryValue;
  completedAppointmentsCount?: number | null;
  showReviewCount?: boolean;
  href: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <RatingStars {...summary} completedAppointmentsCount={completedAppointmentsCount} showReviewCount={showReviewCount} />
      <Button asChild variant="outline" size="sm">
        <Link href={href}>Vezi recenziile</Link>
      </Button>
    </div>
  );
}
