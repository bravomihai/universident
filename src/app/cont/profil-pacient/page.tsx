import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppointmentList } from "@/components/appointments/appointment-list";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";

export const metadata: Metadata = { title: "Profil pacient" };

export default async function PatientProfilePage() {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT) redirect("/cont");
  const result = await listAppointmentsForUser(session.user.id, UserRole.PATIENT);
  const dateOfBirth = result.patientProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? "";
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-5xl space-y-6"><Link href="/cont" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la cont</Link><header><h1 className="text-3xl font-semibold tracking-tight">Profilul pacientului</h1><p className="mt-2 text-muted-foreground">Datele private și istoricul programărilor tale.</p></header><Card><CardHeader><CardTitle>Date pentru programare</CardTitle></CardHeader><CardContent><PatientProfileForm initialDateOfBirth={dateOfBirth} /></CardContent></Card><section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-semibold">Istoric programări</h2><p className="text-sm text-muted-foreground">{result.reputation?.lateCancellations12Months ?? 0} anulări confirmate cu mai puțin de 2 ore în ultimele 12 luni.</p></div><Link href="/cont/programari" className="text-sm font-medium hover:underline">Vezi toate</Link></div><AppointmentList appointments={result.appointments.slice(0, 5)} role="PATIENT" compact /></section></div></main>;
}
