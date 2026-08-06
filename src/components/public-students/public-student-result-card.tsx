import {
  Clock3,
  GraduationCap,
  MapPin,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  clickableCardClassName,
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import type { PublicStudentSummaryDto } from "@/lib/public-students/public-student-service";

type PublicStudentResultCardProps = {
  student: PublicStudentSummaryDto;
  treatmentSlug: string;
  citySlug: string;
};

function compactBio(bio: string) {
  const normalized = bio.trim().replace(/\s+/g, " ");
  return normalized.length > 180
    ? `${normalized.slice(0, 177).trimEnd()}...`
    : normalized;
}

function supervisorName(
  supervisor: PublicStudentSummaryDto["treatment"]["locations"][number]["supervisor"],
) {
  return [supervisor.academicTitle, supervisor.fullName]
    .filter(Boolean)
    .join(" ");
}

export function PublicStudentResultCard({
  student,
  treatmentSlug,
  citySlug,
}: PublicStudentResultCardProps) {
  const profileHref = `/studenti/${encodeURIComponent(
    student.publicSlug,
  )}?tratament=${encodeURIComponent(treatmentSlug)}&oras=${encodeURIComponent(
    citySlug,
  )}`;

  return (
    <Link
      href={profileHref}
      className={clickableCardLinkClassName}
    >
      <Card className={clickableCardClassName}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <PublicStudentAvatar name={student.name} image={student.image} />
              <div className="min-w-0 space-y-1">
                <h2 className="break-words text-lg font-semibold leading-tight">
                  {student.name}
                </h2>
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <GraduationCap
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {student.university} · Anul {student.studyYear}
                  </span>
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground sm:text-sm">
              Vezi profilul
              <span
                className={clickableCardIndicatorClassName}
                aria-hidden="true"
              >
                {">"}
              </span>
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          {student.bio ? (
            <p className="text-sm text-muted-foreground">
              {compactBio(student.bio)}
            </p>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{student.treatment.name}</h3>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" />
                {student.treatment.durationMinutes} min
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {student.treatment.studentDescription ??
                student.treatment.catalogDescription}
            </p>
          </div>

          <ul className="space-y-2.5" aria-label="Locații disponibile">
            {student.treatment.locations.map((location) => (
              <li
                key={`${location.city.slug}:${location.name}:${location.address}`}
                className="rounded-xl border bg-muted/15 p-3"
              >
                <p className="flex items-start gap-1.5 font-medium">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {location.name} · {location.city.name}
                  </span>
                </p>
                <p className="mt-1 pl-5 text-sm text-muted-foreground">
                  {location.address}
                </p>
                <p className="mt-2 flex items-start gap-1.5 pl-5 text-sm text-muted-foreground">
                  <UserRound
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Profesor supervizor: {supervisorName(location.supervisor)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Link>
  );
}
