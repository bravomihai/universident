import { GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBookingPanel } from "@/components/public-students/public-booking-panel";
import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { getPublicStudentProfile } from "@/lib/public-students/public-student-service";

type Props = { params: Promise<{ studentSlug: string; treatmentSlug: string; locationSlug: string }> };

export const metadata: Metadata = { title: "Alege o programare" };

export default async function StudentBookingPage({ params }: Props) {
  const { studentSlug, treatmentSlug, locationSlug } = await params;
  const profile = await getPublicStudentProfile(studentSlug);
  if (!profile) notFound();
  const treatment = profile.treatments.find((item) => item.slug === treatmentSlug);
  const location = treatment?.locations.find((item) => item.routeKey === locationSlug);
  if (!treatment || !location) notFound();
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-6xl space-y-8">
    <Link href={`/studenti?${new URLSearchParams({ tratament: treatmentSlug, oras: location.city.slug })}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la rezultate</Link>
    <header className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
      <PublicStudentAvatar name={profile.name} image={profile.image} className="size-16 text-lg" />
      <div className="min-w-0 flex-1 space-y-2"><h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1><p className="flex items-center gap-2 text-sm text-muted-foreground"><GraduationCap className="size-4" />{profile.university} · Anul {profile.studyYear}</p><RatingSummaryLink summary={profile.reviewData.summary} href={`/studenti/${profile.publicSlug}#recenzii`} /></div>
    </header>
    <section className="rounded-2xl border bg-muted/15 p-5"><h2 className="font-semibold">{treatment.name} · {treatment.durationMinutes} minute</h2><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{location.name}, {location.city.name} · {location.address}</p></section>
    <PublicBookingPanel studentSlug={profile.publicSlug} treatmentSlug={treatment.slug} locationSlug={location.routeKey} />
  </div></main>;
}
