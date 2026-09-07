import { Clock3, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { PublicStudentLocationCard } from "@/components/public-students/public-student-location-card";
import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingStars } from "@/components/reviews/rating-summary";
import { SchedulingReputationCard } from "@/components/reviews/scheduling-reputation-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { formatStudentCancellationReputation } from "@/lib/appointments/student-reputation-label";
import { publicStudentLocationKey } from "@/lib/public-students/public-student-location-key";
import { publicStudentProfileBackLink } from "@/lib/public-students/public-student-profile-navigation";
import { getPublicStudentProfile } from "@/lib/public-students/public-student-service";

type PublicStudentProfilePageProps = {
  params: Promise<{ studentSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const catalogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function singleSlugQueryValue(value: string | string[] | undefined) {
  if (typeof value !== "string") return "";

  const slug = value.trim();
  return slug.length <= 120 && catalogSlugPattern.test(slug) ? slug : "";
}

function treatmentDescription(
  treatment: NonNullable<
    Awaited<ReturnType<typeof getPublicStudentProfile>>
  >["treatments"][number],
) {
  return treatment.studentDescription ?? treatment.catalogDescription;
}

export async function generateMetadata({
  params,
}: PublicStudentProfilePageProps): Promise<Metadata> {
  const { studentSlug } = await params;
  const profile = await getPublicStudentProfile(studentSlug);

  if (!profile) {
    return { title: "Profil indisponibil" };
  }

  return {
    title: `${profile.name} — student la medicină dentară`,
    description: `${profile.name}, student la ${profile.university}. Vezi tratamentele și locațiile publice.`,
  };
}

export default async function PublicStudentProfilePage({
  params,
  searchParams,
}: PublicStudentProfilePageProps) {
  const [{ studentSlug }, query] = await Promise.all([params, searchParams]);
  const profile = await getPublicStudentProfile(studentSlug);

  if (!profile) notFound();

  const treatmentSlug = singleSlugQueryValue(query.tratament);
  const citySlug = singleSlugQueryValue(query.oras);
  const highlightedTreatment = profile.treatments.find(
    (treatment) =>
      treatment.slug === treatmentSlug &&
      treatment.locations.some((location) => location.city.slug === citySlug),
  );
  const backLink = publicStudentProfileBackLink(
    query.sursa,
    highlightedTreatment ? { treatmentSlug, citySlug } : undefined,
  );
  const orderedTreatments = highlightedTreatment
    ? [
        highlightedTreatment,
        ...profile.treatments.filter(
          (treatment) => treatment.slug !== highlightedTreatment.slug,
        ),
      ]
    : profile.treatments;

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <BackLink href={backLink.href}>
          {backLink.label}
        </BackLink>

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <PublicStudentAvatar
            name={profile.name}
            imageUrl={profile.imageUrl}
            className="size-20 text-xl"
          />
          <div className="min-w-0 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {profile.name}
            </h1>
            <p className="flex items-start gap-2 text-muted-foreground">
              <GraduationCap className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {profile.university} · Anul {profile.studyYear}
              </span>
            </p>
            <RatingStars {...profile.reviewData.summary} />
          </div>
        </header>

        {profile.bio ? (
          <section aria-labelledby="public-profile-bio" className="max-w-3xl">
            <h2 id="public-profile-bio" className="text-xl font-semibold">
              Despre student
            </h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">
              {profile.bio}
            </p>
          </section>
        ) : null}

        <SchedulingReputationCard
          count={profile.cancellationsLast10}
          description="Reper calculat din ultimele 10 programări confirmate."
          value={formatStudentCancellationReputation(profile.cancellationsLast10)}
        />

        <ProfileReviewList data={profile.reviewData} title="Recenziile studentului" />

        <section id="tratamente" aria-labelledby="public-profile-treatments" className="scroll-mt-24 space-y-5">
          <div>
            <h2 id="public-profile-treatments" className="text-2xl font-semibold tracking-tight">
              Tratamente și locații
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Alege o locație pentru a vedea orele disponibile pentru tratament.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {orderedTreatments.map((treatment) => {
              const isHighlighted = treatment.slug === highlightedTreatment?.slug;

              return (
                <Card
                  key={treatment.slug}
                  className={isHighlighted ? "ring-2 ring-primary/60" : undefined}
                >
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{treatment.name}</h3>
                        {isHighlighted ? (
                          <p className="mt-1 text-xs font-medium text-primary">
                            Tratamentul din căutarea ta
                          </p>
                        ) : null}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock3 className="size-4" aria-hidden="true" />
                        {treatment.durationMinutes} min
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-sm text-muted-foreground">
                      {treatmentDescription(treatment)}
                    </p>

                    <ul className="space-y-3">
                      {treatment.locations.map((location) => (
                        <li key={publicStudentLocationKey(location)}>
                          <PublicStudentLocationCard
                            studentSlug={profile.publicSlug}
                            treatmentSlug={treatment.slug}
                            treatmentName={treatment.name}
                            location={location}
                            profileSource={query.sursa === "acasa" ? "acasa" : undefined}
                          />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {orderedTreatments.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Nu există momentan tratamente cu ore libere în următoarele 60 de zile.
            </p>
          ) : null}
        </section>

      </div>
    </main>
  );
}
