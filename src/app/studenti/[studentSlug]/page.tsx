import { Clock3, GraduationCap, MapPin, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function supervisorName(
  supervisor: NonNullable<
    Awaited<ReturnType<typeof getPublicStudentProfile>>
  >["treatments"][number]["locations"][number]["supervisor"],
) {
  return [supervisor.academicTitle, supervisor.fullName]
    .filter(Boolean)
    .join(" ");
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
  const backHref = highlightedTreatment
    ? `/studenti?${new URLSearchParams({
        tratament: treatmentSlug,
        oras: citySlug,
      }).toString()}`
    : "/studenti";
  const orderedTreatments = highlightedTreatment
    ? [
        highlightedTreatment,
        ...profile.treatments.filter(
          (treatment) => treatment.slug !== highlightedTreatment.slug,
        ),
      ]
    : profile.treatments;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <Link
          href={backHref}
          className="inline-flex rounded-sm text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          ← Înapoi la {highlightedTreatment ? "rezultate" : "căutare"}
        </Link>

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <PublicStudentAvatar
            name={profile.name}
            image={profile.image}
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

        <section aria-labelledby="public-profile-treatments" className="space-y-5">
          <div>
            <h2 id="public-profile-treatments" className="text-2xl font-semibold tracking-tight">
              Tratamente și locații
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fiecare locație include profesorul supervizor asociat.
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
                        <li
                          key={`${location.city.slug}:${location.name}:${location.address}`}
                          className="rounded-xl border bg-muted/15 p-4"
                        >
                          <p className="flex items-start gap-1.5 font-medium">
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span>
                              {location.name} · {location.city.name}
                            </span>
                          </p>
                          <p className="mt-1 pl-5 text-sm text-muted-foreground">
                            {location.address}
                          </p>
                          <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-sm text-muted-foreground">
                            <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span>
                              Profesor supervizor: {supervisorName(location.supervisor)}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
