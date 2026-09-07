import { CalendarDays, History, Stethoscope, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { AppointmentInformationGrid } from "@/components/appointments/appointment-information-grid";
import { AppointmentStatusBadges } from "@/components/appointments/appointment-status-badges";
import { formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { CancellationReputationLabel } from "@/components/reviews/cancellation-reputation-label";
import { ExpandableReviewComment } from "@/components/reviews/expandable-review-comment";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { appointmentCounterpart } from "@/lib/appointments/appointment-card-data";
import { getAppointmentForUser } from "@/lib/appointments/appointment-service";
import {
  appointmentNeedsAttention,
  hasAppointmentReview,
} from "@/lib/appointments/appointment-presentation";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Detalii programare" };
type Props = { params: Promise<{ appointmentSlug: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT && session.user.role !== UserRole.STUDENT) {
    notFound();
  }

  const { appointmentSlug } = await params;
  const appointment = await getAppointmentForUser(appointmentSlug, session.user.id, session.user.role);
  if (!appointment) notFound();
  const role = session.user.role === UserRole.PATIENT ? "PATIENT" : "STUDENT";
  const reviewedByActor = hasAppointmentReview(appointment, role);
  const ownReview = appointment.reviews.find((review) => review.authorRole === role);
  const counterpart = appointmentCounterpart(appointment, role);
  const studentPatientContext = role === "STUDENT"
    ? await (async () => {
        const [history, recentConfirmedAppointments] = await Promise.all([
          prisma.appointment.findMany({
            where: {
              patientProfileId: appointment.patientProfileId,
              studentProfileId: appointment.studentProfileId,
              id: { not: appointment.id },
            },
            orderBy: { scheduledStartsAt: "desc" },
            take: 10,
            select: {
              routeSlug: true,
              scheduledStartsAt: true,
              treatmentNameSnapshot: true,
              status: true,
            },
          }),
          prisma.appointment.findMany({
            where: { patientProfileId: appointment.patientProfileId, confirmedAt: { not: null } },
            orderBy: { scheduledStartsAt: "desc" },
            take: 10,
            select: { isLateCancellation: true },
          }),
        ]);
        return {
          history,
          lateCancellationsLast10: recentConfirmedAppointments.filter(
            (recentAppointment) => recentAppointment.isLateCancellation,
          ).length,
        };
      })()
    : null;

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl space-y-6">
        <BackLink href="/cont/programari">Înapoi la programări</BackLink>
        <header className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-card">
            <Stethoscope className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1>{appointment.treatmentNameSnapshot}</h1>
            <p className="mt-2 text-muted-foreground">Detaliile programării tale</p>
          </div>
        </header>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Programarea ta</CardTitle>
              <AppointmentStatusBadges
                status={appointment.status}
                role={role}
                needsAttention={appointmentNeedsAttention(appointment, role)}
              />
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <AppointmentInformationGrid appointment={appointment} counterpart={counterpart} />
            <div className="border-t pt-5 empty:hidden">
              <AppointmentActions
                appointmentSlug={appointment.routeSlug}
                version={appointment.version}
                status={appointment.status}
                role={role}
                startsAt={appointment.scheduledStartsAt.toISOString()}
                endsAt={appointment.scheduledEndsAt.toISOString()}
                reviewedByActor={reviewedByActor}
              />
            </div>
          </CardContent>
        </Card>

        {ownReview ? (
          <Card size="sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Recenzia ta</CardTitle>
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Salvată
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 [overflow-wrap:anywhere]">
              <p className="text-lg tracking-wider text-orange-500" aria-label={`${ownReview.rating} din 5 stele`}>
                {"★".repeat(ownReview.rating)}{"☆".repeat(5 - ownReview.rating)}
              </p>
              {ownReview.comment ? (
                <ExpandableReviewComment comment={ownReview.comment} />
              ) : (
                <p className="text-sm text-muted-foreground">Ai trimis ratingul fără comentariu.</p>
              )}
              {!ownReview.publishedAt ? (
                <p className="text-xs text-muted-foreground">
                  Recenzia este salvată și va deveni vizibilă după ce răspunde și cealaltă persoană.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {studentPatientContext ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4" aria-hidden="true" />Contextul pacientului
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border bg-muted/15 p-4">
                <CancellationReputationLabel
                  count={studentPatientContext.lateCancellationsLast10}
                  value={formatLateCancellationReputation(studentPatientContext.lateCancellationsLast10)}
                />
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Sunt luate în calcul ultimele 10 programări confirmate ale pacientului.
                  O anulare este târzie dacă pacientul anulează cu mai puțin de două ore înainte;
                  cererile retrase nu intră în indicator.
                </p>
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-medium">
                  <History className="size-4 text-muted-foreground" aria-hidden="true" />Istoric între voi
                </h3>
                {studentPatientContext.history.length ? (
                  <ul className="space-y-2" role="list">
                    {studentPatientContext.history.map((item) => (
                      <li key={item.routeSlug}>
                        <Link
                          href={`/cont/programari/${encodeURIComponent(item.routeSlug)}`}
                          className={clickableCardLinkClassName}
                        >
                          <div className="ui-card-interactive flex flex-wrap items-center justify-between gap-3 rounded-[var(--card-radius)] border bg-muted/15 p-4">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium">{item.treatmentNameSnapshot}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat("ro-RO", {
                                  dateStyle: "medium",
                                  timeZone: "Europe/Bucharest",
                                }).format(item.scheduledStartsAt)}
                              </p>
                            </div>
                            <AppointmentStatusBadges status={item.status} role={role} />
                            <span className={clickableCardIndicatorClassName} aria-hidden="true">&gt;</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border bg-muted/15 p-4 text-sm text-muted-foreground">
                    Nu aveți alte programări.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
