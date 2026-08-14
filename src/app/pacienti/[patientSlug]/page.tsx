import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { SchedulingReputationCard } from "@/components/reviews/scheduling-reputation-card";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { ageOnDate } from "@/lib/availability/bucharest-time";
import { prisma } from "@/lib/prisma";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { getPublishedProfileReviews } from "@/lib/reviews/profile-review-service";

export const metadata: Metadata = { title: "Profil pacient" };
type Props = { params: Promise<{ patientSlug: string }> };

export default async function PatientReviewsProfilePage({ params }: Props) {
  const session = await requireAccountPageSession();
  const { patientSlug } = await params;
  const patient = await prisma.patientProfile.findUnique({
    where: { profileSlug: patientSlug },
    select: {
      id: true,
      profileSlug: true,
      dateOfBirth: true,
      bio: true,
      user: { select: { id: true, name: true } },
    },
  });
  if (!patient) notFound();

  const isOwner = session.user.role === UserRole.PATIENT && patient.user.id === session.user.id;
  let canView = isOwner;
  if (session.user.role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (student) {
      canView = Boolean(await prisma.appointment.findFirst({
        where: { patientProfileId: patient.id, studentProfileId: student.id },
        select: { id: true },
      }));
    }
  }
  if (!canView) notFound();

  const [reviewData, recentConfirmedAppointments] = await Promise.all([
    getPublishedProfileReviews(patient.user.id, "PATIENT"),
    prisma.appointment.findMany({
      where: { patientProfileId: patient.id, confirmedAt: { not: null } },
      orderBy: { scheduledStartsAt: "desc" },
      take: 10,
      select: { isLateCancellation: true },
    }),
  ]);
  const lateCancellationsLast10 = recentConfirmedAppointments.filter(
    (appointment) => appointment.isLateCancellation,
  ).length;
  const age = patient.dateOfBirth ? ageOnDate(patient.dateOfBirth, new Date()) : null;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-5xl space-y-8">
        <BackLink href={isOwner ? "/cont/profil-pacient" : "/cont/programari"}>Înapoi</BackLink>
        <header className="space-y-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{patient.user.name}</h1>
            {age !== null ? <p className="mt-1 text-muted-foreground">{age} ani</p> : null}
          </div>
          <RatingSummaryLink summary={reviewData.summary} href="#recenzii" />
          {isOwner ? <Button asChild variant="outline" size="sm"><Link href="/cont/profil-pacient">Editează profilul</Link></Button> : null}
        </header>

        {patient.bio ? (
          <section aria-labelledby="patient-profile-bio" className="max-w-3xl">
            <h2 id="patient-profile-bio" className="text-xl font-semibold">Despre pacient</h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{patient.bio}</p>
          </section>
        ) : null}

        <SchedulingReputationCard
          description="Sunt luate în calcul ultimele 10 programări confirmate."
          value={formatLateCancellationReputation(lateCancellationsLast10)}
        />

        <ProfileReviewList data={reviewData} title="Recenziile pacientului" />
      </div>
    </main>
  );
}
