import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { appointmentStatusLabels, formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { getAppointmentForUser } from "@/lib/appointments/appointment-service";
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
  const studentPatientContext = role === "STUDENT" ? await (async () => {
    const rollingStart = new Date(); rollingStart.setUTCFullYear(rollingStart.getUTCFullYear() - 1);
    const [history, late12, lateLifetime] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientProfileId: appointment.patientProfileId, studentProfileId: appointment.studentProfileId, id: { not: appointment.id } },
        orderBy: { scheduledStartsAt: "desc" }, take: 10,
        select: { routeSlug: true, scheduledStartsAt: true, treatmentNameSnapshot: true, status: true },
      }),
      prisma.appointment.count({ where: { patientProfileId: appointment.patientProfileId, isLateCancellation: true, cancelledAt: { gte: rollingStart } } }),
      prisma.appointment.count({ where: { patientProfileId: appointment.patientProfileId, isLateCancellation: true } }),
    ]);
    return { history, late12, lateLifetime };
  })() : null;

  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-4xl space-y-6">
    <Link href="/cont/programari" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la programări</Link>
    <header className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">{appointment.treatmentNameSnapshot}</h1><p className="text-muted-foreground">{formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}</p><span className="inline-flex rounded-full border px-3 py-1 text-sm font-medium">{appointmentStatusLabels[appointment.status]}</span></header>
    <Card><CardHeader><CardTitle>Detalii</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{role === "PATIENT" ? "Student" : "Pacient"}</dt><dd className="font-medium">{role === "PATIENT" ? appointment.studentNameSnapshot : `${appointment.patientNameSnapshot}, ${appointment.patientAgeAtAppointment} ani`}</dd></div><div><dt className="text-muted-foreground">Locație</dt><dd className="font-medium">{appointment.locationNameSnapshot}</dd><dd>{appointment.locationAddressSnapshot}</dd></div><div><dt className="text-muted-foreground">Supervizor</dt><dd className="font-medium">{appointment.supervisorNameSnapshot}</dd></div><div><dt className="text-muted-foreground">Mesajul pacientului</dt><dd className="whitespace-pre-line">{appointment.patientNote ?? "—"}</dd></div>{appointment.statusReason ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motiv</dt><dd>{appointment.statusReason}</dd></div> : null}</dl><div className="mt-5"><AppointmentActions appointmentSlug={appointment.routeSlug} version={appointment.version} status={appointment.status} role={role} startsAt={appointment.scheduledStartsAt.toISOString()} /></div></CardContent></Card>
    {studentPatientContext ? <Card><CardHeader><CardTitle>Contextul pacientului</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full border px-3 py-1">{studentPatientContext.late12} anulări târzii în ultimele 12 luni</span><span className="rounded-full border px-3 py-1">{studentPatientContext.lateLifetime} în total</span></div><div><p className="font-medium">Istoric între voi</p>{studentPatientContext.history.length ? <ul className="mt-2 space-y-2 text-sm">{studentPatientContext.history.map((item) => <li key={item.routeSlug} className="flex flex-wrap justify-between gap-2 border-b pb-2"><Link href={`/cont/programari/${item.routeSlug}`} className="hover:underline">{item.treatmentNameSnapshot} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeZone: "Europe/Bucharest" }).format(item.scheduledStartsAt)}</Link><span>{appointmentStatusLabels[item.status]}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Nu aveți alte programări.</p>}</div></CardContent></Card> : null}
    {appointment.status === "COMPLETED" ? <Card><CardContent className="p-4 text-sm text-muted-foreground">Întâlnirea este eligibilă pentru câte o recenzie din partea pacientului și a studentului. Formularul de recenzie va fi activat într-o etapă ulterioară.</CardContent></Card> : null}
  </div></main>;
}
