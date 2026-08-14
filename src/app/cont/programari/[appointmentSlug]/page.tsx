import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { appointmentStatusLabels, formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { ExpandableReviewComment } from "@/components/reviews/expandable-review-comment";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { getAppointmentForUser } from "@/lib/appointments/appointment-service";
import { hasAppointmentReview } from "@/lib/appointments/appointment-presentation";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Detalii programare" };
type Props = { params: Promise<{ appointmentSlug: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT && session.user.role !== UserRole.STUDENT) notFound();
  const { appointmentSlug } = await params;
  const appointment = await getAppointmentForUser(appointmentSlug, session.user.id, session.user.role);
  if (!appointment) notFound();
  const role = session.user.role === UserRole.PATIENT ? "PATIENT" : "STUDENT";
  const reviewedByActor = hasAppointmentReview(appointment, role);
  const ownReview = appointment.reviews.find((review) => review.authorRole === role);
  const counterpartRatings = role === "PATIENT"
    ? appointment.studentProfile.user.reviewsReceived
    : appointment.patientProfile.user.reviewsReceived;
  const counterpartReviewSummary = {
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
  const studentPatientContext = role === "STUDENT" ? await (async () => {
    const [history, recentConfirmedAppointments] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientProfileId: appointment.patientProfileId, studentProfileId: appointment.studentProfileId, id: { not: appointment.id } },
        orderBy: { scheduledStartsAt: "desc" }, take: 10,
        select: { routeSlug: true, scheduledStartsAt: true, treatmentNameSnapshot: true, status: true },
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
  })() : null;

  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-4xl space-y-6">
    <BackLink href="/cont/programari">Înapoi la programări</BackLink>
    <header className="space-y-2"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><Stethoscope className="size-5" aria-hidden="true" /></span><h1 className="text-3xl font-semibold tracking-tight">{appointment.treatmentNameSnapshot}</h1></div><p className="text-muted-foreground">{formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}</p><span className="inline-flex rounded-full border px-3 py-1 text-sm font-medium">{appointmentStatusLabels[appointment.status]}</span></header>
    <Card><CardHeader><CardTitle>Detalii</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{role === "PATIENT" ? "Student" : "Pacient"}</dt><dd className="font-medium">{role === "PATIENT" ? appointment.studentNameSnapshot : `${appointment.patientNameSnapshot}, ${appointment.patientAgeAtAppointment} ani`}</dd></div><div><dt className="text-muted-foreground">Locație</dt><dd className="font-medium">{appointment.locationNameSnapshot}</dd><dd>{appointment.locationAddressSnapshot}</dd></div><div><dt className="text-muted-foreground">Supervizor</dt><dd className="font-medium">{appointment.supervisorNameSnapshot}</dd></div><div><dt className="text-muted-foreground">Mesajul pacientului</dt><dd className="whitespace-pre-line font-semibold text-foreground">{appointment.patientNote ?? "—"}</dd></div>{appointment.statusReason ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motiv</dt><dd>{appointment.statusReason}</dd></div> : null}</dl><div className="mt-5"><AppointmentActions appointmentSlug={appointment.routeSlug} version={appointment.version} status={appointment.status} role={role} startsAt={appointment.scheduledStartsAt.toISOString()} endsAt={appointment.scheduledEndsAt.toISOString()} reviewedByActor={reviewedByActor} /></div></CardContent></Card>
    {counterpartProfileHref ? <Card size="sm" className="py-3"><CardContent className="space-y-1.5 px-4"><p className="font-semibold">{role === "PATIENT" ? appointment.studentNameSnapshot : appointment.patientNameSnapshot}</p><RatingSummaryLink summary={counterpartReviewSummary} href={counterpartProfileHref} /></CardContent></Card> : null}
    {ownReview ? <Card size="sm" className="py-3"><CardContent className="space-y-2 px-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">Recenzia ta</p><span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Salvată</span></div><p className="text-lg tracking-wider text-orange-500" aria-label={`${ownReview.rating} din 5 stele`}>{"★".repeat(ownReview.rating)}{"☆".repeat(5 - ownReview.rating)}</p></div>{ownReview.comment ? <ExpandableReviewComment comment={ownReview.comment} /> : <p className="text-sm text-muted-foreground">Ai trimis ratingul fără comentariu.</p>}{!ownReview.publishedAt ? <p className="text-xs text-muted-foreground">Recenzia este salvată și va deveni vizibilă după ce răspunde și cealaltă persoană.</p> : null}</CardContent></Card> : null}
    {studentPatientContext ? <Card><CardHeader><CardTitle>Contextul pacientului</CardTitle></CardHeader><CardContent className="space-y-4"><div><span className="rounded-full border px-3 py-1 text-sm">{formatLateCancellationReputation(studentPatientContext.lateCancellationsLast10)}</span><p className="mt-2 text-xs text-muted-foreground">Sunt luate în calcul ultimele 10 programări confirmate ale pacientului. O anulare este târzie dacă pacientul anulează cu mai puțin de două ore înainte; cererile retrase nu intră în indicator.</p></div><div><p className="font-medium">Istoric între voi</p>{studentPatientContext.history.length ? <ul className="mt-2 space-y-2 text-sm">{studentPatientContext.history.map((item) => <li key={item.routeSlug} className="flex flex-wrap justify-between gap-2 border-b pb-2"><Link href={`/cont/programari/${item.routeSlug}`} className="hover:underline">{item.treatmentNameSnapshot} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeZone: "Europe/Bucharest" }).format(item.scheduledStartsAt)}</Link><span>{appointmentStatusLabels[item.status]}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Nu aveți alte programări.</p>}</div></CardContent></Card> : null}
  </div></main>;
}
