import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RatingSummaryValue = {
  averageRating: number | null;
  reviewCount: number;
};

export function RatingStars({
  averageRating,
  reviewCount,
  className,
}: RatingSummaryValue & { className?: string }) {
  const roundedRating = Math.round(averageRating ?? 0);
  const reviewLabel = reviewCount === 1 ? "1 recenzie" : `${reviewCount} recenzii`;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span
        className="text-lg tracking-wider text-orange-500"
        aria-label={reviewCount ? `${averageRating?.toFixed(1)} din 5 stele` : "Fără recenzii"}
      >
        {"★".repeat(roundedRating)}{"☆".repeat(5 - roundedRating)}
      </span>
      <span className="text-sm font-medium">
        {reviewCount ? `${averageRating?.toFixed(1)} · ${reviewLabel}` : "0 recenzii"}
      </span>
    </span>
  );
}

export function RatingSummaryLink({
  summary,
  href,
  className,
}: {
  summary: RatingSummaryValue;
  href: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <RatingStars {...summary} />
      <Button asChild variant="outline" size="sm">
        <Link href={href}>Vezi recenziile</Link>
      </Button>
    </div>
  );
}
