import type { ReactNode } from "react";

import { RatingStars, type RatingSummaryValue } from "@/components/reviews/rating-summary";
import { clickableCardIndicatorClassName } from "@/components/ui/clickable-card-styles";
import { completedAppointmentCountLabel } from "@/lib/public-students/public-student-directory-order";
import { cn } from "@/lib/utils";

import styles from "./public-student-card-layout.module.css";

export function PublicStudentCardFooter({
  lead,
  rating,
  completedAppointmentsCount,
  className,
  arrowClassName,
}: {
  lead?: ReactNode;
  rating?: RatingSummaryValue;
  completedAppointmentsCount?: number | null;
  className?: string;
  arrowClassName?: string;
}) {
  return (
    <div className={cn(styles.footer, className)}>
      {lead ? <div className={styles.lead}>{lead}</div> : null}
      {rating ? (
        <div className={styles.rating}>
          <RatingStars {...rating} showReviewCount={false} className="flex-nowrap" />
        </div>
      ) : null}
      {completedAppointmentsCount != null ? (
        <p className={styles.count}>{completedAppointmentCountLabel(completedAppointmentsCount)}</p>
      ) : null}
      <span className={cn(styles.arrow, clickableCardIndicatorClassName, arrowClassName)} aria-hidden="true">&gt;</span>
    </div>
  );
}
