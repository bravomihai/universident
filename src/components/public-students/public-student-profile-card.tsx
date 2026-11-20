import { GraduationCap, MapPin } from "lucide-react";

import Link from "@/components/navigation/app-link";
import { PublicStudentCardFooter } from "@/components/public-students/public-student-card-footer";
import type { RatingSummaryValue } from "@/components/reviews/rating-summary";
import { Card } from "@/components/ui/card";
import { clickableCardClassName, clickableCardLinkClassName } from "@/components/ui/clickable-card-styles";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { publicStudentProfileHref } from "@/lib/public-students/public-student-profile-navigation";
import { cn } from "@/lib/utils";
import layout from "./public-student-card-layout.module.css";
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
    <Link href={publicStudentProfileHref(student.publicSlug)} prefetch={directory ? false : undefined} className={cn(clickableCardLinkClassName, layout.frame)}>
      <Card className={cn(clickableCardClassName, layout.frame, styles.card, directory && styles.compact)}>
        <div>
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
        </div>
        <PublicStudentCardFooter
          lead={student.refreshedAt ? (
            <span>Actualizat <time dateTime={student.refreshedAt}>{refreshedDate.format(new Date(student.refreshedAt))}</time></span>
          ) : null}
          rating={student.rating}
          completedAppointmentsCount={student.completedAppointmentsCount}
          className={styles.bottom}
          arrowClassName={styles.arrow}
        />
      </Card>
    </Link>
  );
}
