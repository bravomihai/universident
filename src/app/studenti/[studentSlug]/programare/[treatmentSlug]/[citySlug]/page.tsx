import { GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingPanel } from "@/components/public-students/public-booking-panel";
import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { BackLink } from "@/components/ui/back-link";
import { getPublicStudentProfile } from "@/lib/public-students/public-student-service";
import { parsePublicBookingLocation } from "@/lib/public-students/public-booking-location";
import { publicStudentProfileHref } from "@/lib/public-students/public-student-profile-navigation";

type Props = {
  params: Promise<{
    studentSlug: string;
    treatmentSlug: string;
    citySlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Alege o programare" };

export default async function StudentBookingPage({ params, searchParams }: Props) {
  const [{ studentSlug, treatmentSlug, citySlug }, query] = await Promise.all([params, searchParams]);
  const locationRouteKey = parsePublicBookingLocation(query.locatie);
  if (locationRouteKey === null) notFound();
  const profile = await getPublicStudentProfile(studentSlug);
  if (!profile) notFound();

  const treatment = profile.treatments.find(
    (item) => item.slug === treatmentSlug,
  );
  if (!treatment) notFound();

  const matchingLocations = treatment.locations.filter(
    (item) => item.city.slug === citySlug && (!locationRouteKey || item.routeKey === locationRouteKey),
  );
  if (matchingLocations.length === 0) notFound();

  const city = matchingLocations[0].city;
  const selectedLocation = locationRouteKey ? matchingLocations[0] : null;
  const backQuery = new URLSearchParams({ tratament: treatmentSlug, oras: city.slug });
  const backHref = selectedLocation
    ? publicStudentProfileHref(profile.publicSlug, {
        source: query.sursa,
        treatmentSlug,
        citySlug: city.slug,
        section: "tratamente",
      })
    : `/studenti?${backQuery}`;
  const locationCount = new Set(
    matchingLocations.map((location) => location.routeKey),
  ).size;

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <BackLink href={backHref}>
          {selectedLocation ? "Înapoi la profil" : "Înapoi la rezultate"}
        </BackLink>

        <header className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <PublicStudentAvatar
            name={profile.name}
            imageUrl={profile.imageUrl}
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
              href={publicStudentProfileHref(profile.publicSlug, {
                source: query.sursa,
                section: "recenzii",
              })}
            />
          </div>
        </header>

        <section className="rounded-2xl border bg-muted/15 p-5">
          <h2 className="font-semibold">
            {treatment.name} · {treatment.durationMinutes} minute
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {selectedLocation ? `${selectedLocation.name} · ${city.name}` : locationCount === 1
              ? `O locație disponibilă în ${city.name}`
              : `${locationCount} locații disponibile în ${city.name}`}
          </p>
          {selectedLocation ? (
            <p className="mt-1 pl-6 text-sm text-muted-foreground">{selectedLocation.address}</p>
          ) : null}
        </section>

        <PublicBookingPanel
          key={`${profile.publicSlug}:${treatment.slug}:${city.slug}:${locationRouteKey ?? "all"}`}
          studentSlug={profile.publicSlug}
          treatmentSlug={treatment.slug}
          citySlug={city.slug}
          locationRouteKey={locationRouteKey}
        />
      </div>
    </main>
  );
}
