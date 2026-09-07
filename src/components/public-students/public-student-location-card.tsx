import { MapPin, UserRound } from "lucide-react";
import Link from "next/link";

import {
  clickableCardClassName,
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import { publicStudentBookingHref } from "@/lib/public-students/public-student-booking-links";
import type { PublicStudentLocationDto } from "@/lib/public-students/public-student-service";
import { cn } from "@/lib/utils";

export function PublicStudentLocationCard({
  studentSlug,
  treatmentSlug,
  treatmentName,
  location,
  profileSource,
}: {
  studentSlug: string;
  treatmentSlug: string;
  treatmentName: string;
  location: PublicStudentLocationDto;
  profileSource?: "acasa";
}) {
  const supervisorName = [location.supervisor.academicTitle, location.supervisor.fullName].filter(Boolean).join(" ");
  return (
    <Link
      href={publicStudentBookingHref(studentSlug, treatmentSlug, location.city.slug, location.routeKey, profileSource)}
      className={clickableCardLinkClassName}
      style={{ borderRadius: "0.75rem" }}
      aria-label={`Alege o programare pentru ${treatmentName} la ${location.name}, ${location.city.name}. Profesor supervizor: ${supervisorName}.`}
    >
      <div className={cn(clickableCardClassName, "rounded-xl border bg-muted/15 p-4")}>
        <p className="flex items-start gap-1.5 font-medium">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{location.name} · {location.city.name}</span>
        </p>
        <p className="mt-1 pl-5 text-sm text-muted-foreground">{location.address}</p>
        <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-sm text-muted-foreground">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Profesor supervizor: {supervisorName}</span>
        </p>
        <span className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
          Alege o programare
          <span className={clickableCardIndicatorClassName} aria-hidden="true">{">"}</span>
        </span>
      </div>
    </Link>
  );
}
