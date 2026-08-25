import { GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingPanel } from "@/components/public-students/public-booking-panel";
import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { BackLink } from "@/components/ui/back-link";
import { getPublicStudentProfile } from "@/lib/public-students/public-student-service";

type Props = {
  params: Promise<{
    studentSlug: string;
    treatmentSlug: string;
    citySlug: string;
  }>;
};

export const metadata: Metadata = { title: "Alege o programare" };

export default async function StudentBookingPage({ params }: Props) {
  const { studentSlug, treatmentSlug, citySlug } = await params;
  const profile = await getPublicStudentProfile(studentSlug);
  if (!profile) notFound();

  const treatment = profile.treatments.find(
    (item) => item.slug === treatmentSlug,
  );
  if (!treatment) notFound();

  const matchingLocations = treatment.locations.filter(
    (item) => item.city.slug === citySlug,
  );
  if (matchingLocations.length === 0) notFound();

  const city = matchingLocations[0].city;
  const locationCount = new Set(
    matchingLocations.map((location) => location.routeKey),
  ).size;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <BackLink
          href={`/studenti?${new URLSearchParams({
            tratament: treatmentSlug,
            oras: city.slug,
          })}`}
        >
          Înapoi la rezultate
        </BackLink>

        <header className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <PublicStudentAvatar
            name={profile.name}
            className="size-16 text-lg"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.name}
            </h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="size-4" />
              {profile.university} · Anul {profile.studyYear}
            </p>
            <RatingSummaryLink
              summary={profile.reviewData.summary}
              href={`/studenti/${profile.publicSlug}#recenzii`}
            />
          </div>
        </header>

        <section className="rounded-2xl border bg-muted/15 p-5">
          <h2 className="font-semibold">
            {treatment.name} · {treatment.durationMinutes} minute
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {locationCount === 1
              ? `O locație disponibilă în ${city.name}`
              : `${locationCount} locații disponibile în ${city.name}`}
          </p>
        </section>

        <PublicBookingPanel
          studentSlug={profile.publicSlug}
          treatmentSlug={treatment.slug}
          citySlug={city.slug}
        />
      </div>
    </main>
  );
}
