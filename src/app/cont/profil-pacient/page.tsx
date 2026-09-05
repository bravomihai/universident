import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileImageForm } from "@/components/account/profile-image-form";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { SchedulingReputationCard } from "@/components/reviews/scheduling-reputation-card";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { patientProfileImageUrl } from "@/lib/patient/patient-profile-image";
import { prisma } from "@/lib/prisma";
import { getPublishedProfileReviews } from "@/lib/reviews/profile-review-service";

export const metadata: Metadata = { title: "Profil pacient" };

export default async function PatientProfilePage() {
  const session = await requireAccountPageSession();
  if (session.user.role !== UserRole.PATIENT) redirect("/cont");
  const result = await listAppointmentsForUser(session.user.id, UserRole.PATIENT);
  const reviewData = await getPublishedProfileReviews(session.user.id, "PATIENT");
  const dateOfBirth = result.patientProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? "";
  const bio = result.patientProfile?.bio ?? "";
  const image = await prisma.patientProfileImage.findFirst({
    where: { patientProfile: { userId: session.user.id } },
    select: { id: true, updatedAt: true },
  });
  const imageUrl = patientProfileImageUrl(image);
  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-5xl space-y-6">
        <BackLink href="/cont">Înapoi la cont</BackLink>
        <header className="space-y-3">
          <div>
            <div className="flex items-center gap-3">
              <ProfileAvatar
                name={session.user.name}
                imageUrl={imageUrl}
                className="size-10 text-sm"
              />
              <h1 className="text-3xl font-semibold tracking-tight">
                Profilul pacientului
              </h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              Datele profilului și recenziile tale.
            </p>
          </div>
          <RatingSummaryLink summary={reviewData.summary} href="#recenzii" />
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Fotografie de profil (opțional)</CardTitle>
            <p className="text-sm text-muted-foreground">
              O poți adăuga sau șterge oricând. Este vizibilă doar pentru tine și
              studenții cu care ai avut o cerere de programare sau o programare.
              Fără fotografie, profilul afișează inițialele tale.
            </p>
          </CardHeader>
          <CardContent>
            <ProfileImageForm
              name={session.user.name}
              initialImageUrl={imageUrl}
              uploadUrl="/api/profil-pacient/image"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Date pentru profil</CardTitle>
          </CardHeader>
          <CardContent>
            <PatientProfileForm
              initialName={session.user.name}
              initialDateOfBirth={dateOfBirth}
              initialBio={bio}
            />
          </CardContent>
        </Card>

        <SchedulingReputationCard
          description="Reper calculat din ultimele 10 programări confirmate."
          value={formatLateCancellationReputation(
            result.reputation?.lateCancellationsLast10 ?? 0,
          )}
        />

        <ProfileReviewList data={reviewData} title="Recenziile tale" />
      </div>
    </main>
  );
}
