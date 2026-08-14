import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { getPublishedProfileReviews } from "@/lib/reviews/profile-review-service";

export const metadata: Metadata = { title: "Profil pacient" };

export default async function PatientProfilePage() {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT) redirect("/cont");
  const result = await listAppointmentsForUser(session.user.id, UserRole.PATIENT);
  const reviewData = await getPublishedProfileReviews(session.user.id, "PATIENT");
  const dateOfBirth = result.patientProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? "";
  const bio = result.patientProfile?.bio ?? "";
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-5xl space-y-6"><Link href="/cont" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la cont</Link><header className="space-y-3"><div><h1 className="text-3xl font-semibold tracking-tight">Profilul pacientului</h1><p className="mt-2 text-muted-foreground">Datele profilului și recenziile tale.</p></div><RatingSummaryLink summary={reviewData.summary} href="#recenzii" /></header><Card><CardHeader><CardTitle>Date pentru profil</CardTitle></CardHeader><CardContent><PatientProfileForm initialDateOfBirth={dateOfBirth} initialBio={bio} /></CardContent></Card><Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold">Reputație de programare</p><p className="text-sm text-muted-foreground">Reper calculat din ultimele 10 programări confirmate.</p></div><span className="rounded-full border px-3 py-1 text-sm font-medium">{formatLateCancellationReputation(result.reputation?.lateCancellationsLast10 ?? 0)}</span></CardContent></Card><ProfileReviewList data={reviewData} title="Recenziile tale" /></div></main>;
}
