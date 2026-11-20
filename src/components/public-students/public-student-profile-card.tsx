import { GraduationCap, MapPin } from "lucide-react";

import Link from "@/components/navigation/app-link";
import { RatingStars, type RatingSummaryValue } from "@/components/reviews/rating-summary";
import { Card } from "@/components/ui/card";
import { clickableCardClassName, clickableCardIndicatorClassName, clickableCardLinkClassName } from "@/components/ui/clickable-card-styles";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { publicStudentProfileHref } from "@/lib/public-students/public-student-profile-navigation";
import { cn } from "@/lib/utils";
import styles from "./public-student-profile-card.module.css";

type ProfileCardStudent = {
  publicSlug: string;
  name: string;
  university: string;
  studyYear: number;
  imageUrl: string | null;
  bio?: string | null;
  cities: string[];
  treatments: string[];
  refreshedAt: string | null;
  rating?: RatingSummaryValue;
  completedAppointmentsCount?: number | null;
};

const refreshedDate = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Bucharest",
});

export function PublicStudentProfileCard({
  student,
  directory = false,
  heading: Heading = directory ? "h2" : "h3",
}: {
  student: ProfileCardStudent;
  directory?: boolean;
  heading?: "h2" | "h3";
}) {
  return (
    <Link href={publicStudentProfileHref(student.publicSlug)} prefetch={directory ? false : undefined} className={clickableCardLinkClassName}>
      <Card className={cn(clickableCardClassName, styles.card, directory && styles.compact)}>
        <div className={styles.top}>
          <ProfileAvatar name={student.name} imageUrl={student.imageUrl} className={styles.avatar} />
          <span className={styles.year}>Anul {student.studyYear}</span>
        </div>
        <Heading className={styles.name}>{student.name}</Heading>
        <p className={styles.meta}><GraduationCap aria-hidden="true" />{student.university}</p>
        {student.cities.length > 0 ? (
          <p className={styles.meta}><MapPin aria-hidden="true" />{student.cities.join(" · ")}</p>
        ) : null}
        {student.bio ? <p className={cn(styles.bio, "line-clamp-3")}>{student.bio}</p> : null}
        {student.treatments.length > 0 ? (
          <ul className={styles.treatments}>
            {student.treatments.map((treatment) => <li key={treatment}>{treatment}</li>)}
          </ul>
        ) : null}
        <div className={styles.bottom}>
          <div className={styles.bottomDetails}>
            {student.refreshedAt ? (
              <span>Actualizat <time dateTime={student.refreshedAt}>{refreshedDate.format(new Date(student.refreshedAt))}</time></span>
            ) : null}
            {student.rating ? (
              <RatingStars
                {...student.rating}
                completedAppointmentsCount={student.completedAppointmentsCount}
                className="gap-y-0"
              />
            ) : null}
          </div>
          <span className={cn(styles.arrow, clickableCardIndicatorClassName)} aria-hidden="true">&gt;</span>
        </div>
      </Card>
    </Link>
  );
}
