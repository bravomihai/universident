import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentList } from "@/components/appointments/appointment-list";
import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { appointmentIsArchived } from "@/lib/appointments/appointment-presentation";

export const metadata: Metadata = { title: "Programările mele", description: "Cererile și programările tale Universident." };

export default async function AppointmentsPage() {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT && session.user.role !== UserRole.STUDENT) return null;
  const result = await listAppointmentsForUser(session.user.id, session.user.role);
  const role = session.user.role === UserRole.PATIENT ? "PATIENT" : "STUDENT";
  const activeAppointments = result.appointments.filter(
    (appointment) => !appointmentIsArchived(appointment, role),
  );
  const archivedAppointments = result.appointments.filter(
    (appointment) => appointmentIsArchived(appointment, role),
  );
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-5xl space-y-6">
    <Link href="/cont" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la cont</Link>
    <header className="space-y-2"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><CalendarDays className="size-5" /></span><h1 className="text-3xl font-semibold tracking-tight">Programările mele</h1></div><p className="text-muted-foreground">{role === "PATIENT" ? "Urmărește cererile trimise și programările confirmate." : "Confirmă cererile și înregistrează rezultatul întâlnirilor."}</p></header>
    {role === "PATIENT" && result.reputation ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">Reputație de programare</p><p className="text-sm text-muted-foreground">Anulările cererilor neconfirmate nu sunt penalizate.</p></div><span className="rounded-full border px-3 py-1 text-sm font-medium">{result.reputation.lateCancellationsLast10} anulări târzii în ultimele 10 programări</span></CardContent></Card> : null}
    <section className="space-y-3" aria-labelledby="active-appointments-title"><div><h2 id="active-appointments-title" className="text-xl font-semibold">Active</h2><p className="text-sm text-muted-foreground">Programările care urmează și cele care mai necesită o acțiune apar aici.</p></div><AppointmentList appointments={activeAppointments} role={role} emptyMessage="Nu există programări active." /></section>
    <section className="space-y-3" aria-labelledby="archived-appointments-title"><div><h2 id="archived-appointments-title" className="text-xl font-semibold">Arhivate</h2><p className="text-sm text-muted-foreground">Programări închise, recenzate, anulate, respinse sau expirate.</p></div><AppointmentList appointments={archivedAppointments} role={role} emptyMessage="Nu există încă programări arhivate." /></section>
  </div></main>;
}
