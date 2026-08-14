import Link from "next/link";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { appointmentStatusLabels, formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { RatingStars } from "@/components/reviews/rating-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  appointmentNeedsAttention,
  hasAppointmentReview,
  orderAppointmentsForRole,
} from "@/lib/appointments/appointment-presentation";
import { cn } from "@/lib/utils";

export type AppointmentListItem = {
  routeSlug: string;
  version: number;
  status: string;
  scheduledStartsAt: Date | string;
  scheduledEndsAt: Date | string;
  patientNameSnapshot: string;
  studentNameSnapshot: string;
  treatmentNameSnapshot: string;
  locationNameSnapshot: string;
  isLateCancellation: boolean;
  statusReason: string | null;
  patientNote: string | null;
  patientProfile: {
    profileSlug: string;
    user: { reviewsReceived: Array<{ rating: number }> };
  };
  studentProfile: {
    publicSlug: string | null;
    user: { reviewsReceived: Array<{ rating: number }> };
  };
  reviews: Array<{
    authorRole: string;
    rating?: number;
    comment?: string | null;
    publishedAt?: Date | string | null;
  }>;
};

export function AppointmentList({
  appointments,
  role,
  compact = false,
  emptyMessage = "Nu există încă programări.",
}: {
  appointments: AppointmentListItem[];
  role: "PATIENT" | "STUDENT";
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (appointments.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  const now = new Date();
  const orderedAppointments = orderAppointmentsForRole(appointments, role, now);
  return (
    <div className="grid gap-3">
      {orderedAppointments.map((appointment) => {
        const needsAttention = appointmentNeedsAttention(appointment, role, now);
        const reviewedByActor = hasAppointmentReview(appointment, role);
        const ownReview = appointment.reviews.find((review) => review.authorRole === role);
        const counterpartRatings = role === "PATIENT"
          ? appointment.studentProfile.user.reviewsReceived
          : appointment.patientProfile.user.reviewsReceived;
        const counterpartSummary = {
          averageRating: counterpartRatings.length
            ? counterpartRatings.reduce((total, review) => total + review.rating, 0) / counterpartRatings.length
            : null,
          reviewCount: counterpartRatings.length,
        };
        const counterpartProfileHref = role === "PATIENT"
          ? appointment.studentProfile.publicSlug
            ? `/studenti/${appointment.studentProfile.publicSlug}#recenzii`
            : null
          : `/pacienti/${appointment.patientProfile.profileSlug}#recenzii`;
        const attentionLabel = role === "STUDENT" && appointment.status === "CONFIRMED"
          ? "Necesită închidere"
          : "Recenzie necesară";
        return <Card
          key={appointment.routeSlug}
          className={cn(
            "group relative h-full cursor-pointer transition duration-150 hover:bg-muted/15 hover:shadow-sm hover:ring-primary/35 has-focus-visible:bg-muted/15 has-focus-visible:ring-primary/35",
            needsAttention && "border-orange-400/70 bg-orange-500/10 ring-1 ring-orange-400/30 hover:bg-orange-500/15 hover:ring-orange-400/60",
          )}
        >
          <Link
            href={`/cont/programari/${appointment.routeSlug}`}
            className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={`Vezi programarea pentru ${appointment.treatmentNameSnapshot}`}
          >
            <span className="sr-only">Vezi detaliile</span>
          </Link>
          <CardContent className="pointer-events-none relative z-10 space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{appointment.treatmentNameSnapshot}</p>
                <p className="text-sm text-muted-foreground">
                  {formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {role === "PATIENT" ? appointment.studentNameSnapshot : appointment.patientNameSnapshot} · {appointment.locationNameSnapshot}
                </p>
                <div className="pointer-events-auto relative z-20 mt-2 flex flex-wrap items-center gap-2">
                  <RatingStars {...counterpartSummary} className="gap-1.5" />
                  {counterpartProfileHref ? <Button asChild variant="outline" size="sm"><Link href={counterpartProfileHref}>Vezi recenziile</Link></Button> : null}
                </div>
              </div>
              <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-medium">
                {needsAttention ? attentionLabel : appointmentStatusLabels[appointment.status] ?? appointment.status}
              </span>
            </div>
            {role === "STUDENT" && (appointment.status === "PENDING" || appointment.status === "CONFIRMED") && appointment.patientNote ? (
              <div className="rounded-xl border bg-background/70 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mesajul pacientului
                </p>
                <p className="mt-1 whitespace-pre-line text-sm font-semibold text-foreground">
                  {appointment.patientNote}
                </p>
              </div>
            ) : null}
            {!compact && appointment.statusReason ? <p className="text-sm text-muted-foreground">Motiv: {appointment.statusReason}</p> : null}
            {ownReview?.rating ? (
              <div className="rounded-xl border bg-background/65 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Recenzia ta</p>
                  <span className="text-base tracking-wider text-orange-500" aria-label={`${ownReview.rating} din 5 stele`}>
                    {"★".repeat(ownReview.rating)}{"☆".repeat(5 - ownReview.rating)}
                  </span>
                </div>
                {ownReview.comment ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{ownReview.comment}</p> : null}
                {!ownReview.publishedAt ? <p className="mt-1 text-xs text-muted-foreground">Recenzia va deveni vizibilă după ce răspunde și cealaltă persoană.</p> : null}
              </div>
            ) : null}
            {!compact || needsAttention ? (
              <div className="pointer-events-auto relative z-20">
                <AppointmentActions
                  appointmentSlug={appointment.routeSlug}
                  version={appointment.version}
                  status={appointment.status}
                  role={role}
                  startsAt={new Date(appointment.scheduledStartsAt).toISOString()}
                  endsAt={new Date(appointment.scheduledEndsAt).toISOString()}
                  reviewedByActor={reviewedByActor}
                />
              </div>
            ) : null}
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              Vezi detaliile <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </CardContent>
        </Card>;
      })}
    </div>
  );
}
