import { SearchX, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicStudentResultCard } from "@/components/public-students/public-student-result-card";
import { PublicStudentSearchForm } from "@/components/public-students/public-student-search-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getPublicStudentCatalog,
  searchPublicStudents,
} from "@/lib/public-students/public-student-service";

type StudentsPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type StudentsPageProps = {
  searchParams: StudentsPageSearchParams;
};

function singleQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function requestedPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function resultsUrl(treatmentSlug: string, citySlug: string, page?: number) {
  const params = new URLSearchParams({
    tratament: treatmentSlug,
    oras: citySlug,
  });
  if (page && page > 1) params.set("pagina", String(page));
  return `/studenti?${params.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: StudentsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const treatmentSlug = singleQueryValue(params.tratament);
  const citySlug = singleQueryValue(params.oras);
  const catalog = await getPublicStudentCatalog();
  const treatment = catalog.treatments.find(
    (option) => option.slug === treatmentSlug,
  );
  const city = catalog.cities.find((option) => option.slug === citySlug);

  if (treatment && city) {
    return {
      title: `Studenți pentru ${treatment.name} în ${city.name}`,
      description: `Descoperă studenți care oferă ${treatment.name.toLocaleLowerCase(
        "ro-RO",
      )} în ${city.name}.`,
    };
  }

  return {
    title: "Găsește un student",
    description:
      "Alege tratamentul și orașul pentru a descoperi studenți la medicină dentară.",
  };
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const requestedTreatmentSlug = singleQueryValue(params.tratament);
  const requestedCitySlug = singleQueryValue(params.oras);
  const page = requestedPage(params.pagina);
  const catalog = await getPublicStudentCatalog();
  const treatment = catalog.treatments.find(
    (option) => option.slug === requestedTreatmentSlug,
  );
  const city = catalog.cities.find(
    (option) => option.slug === requestedCitySlug,
  );
  const hasRequestedFilters = Boolean(
    requestedTreatmentSlug || requestedCitySlug,
  );
  const hasInvalidFilter =
    (requestedTreatmentSlug.length > 0 && !treatment) ||
    (requestedCitySlug.length > 0 && !city) ||
    Array.isArray(params.tratament) ||
    Array.isArray(params.oras);
  const hasCompleteSelection = Boolean(treatment && city);

  const search =
    treatment && city
      ? await searchPublicStudents({
          treatmentSlug: treatment.slug,
          citySlug: city.slug,
          page,
        })
      : null;

  if (search && search.totalResults > 0 && page > search.totalPages) {
    redirect(resultsUrl(treatment!.slug, city!.slug, search.totalPages));
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <header className="max-w-3xl space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Descoperă studenți
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Găsește tratamentul potrivit în orașul tău
          </h1>
          <p className="text-muted-foreground">
            Alege mai întâi tratamentul, apoi orașul. Vei vedea numai profiluri
            publicate cu oferte active și supervizare atribuită.
          </p>
        </header>

        <PublicStudentSearchForm
          treatments={catalog.treatments}
          cities={catalog.cities}
          selectedTreatmentSlug={treatment?.slug ?? ""}
          selectedCitySlug={city?.slug ?? ""}
        />

        <section aria-live="polite" aria-atomic="false">
          {!hasCompleteSelection && !hasInvalidFilter ? (
            <Card className="border-dashed bg-muted/15">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
                  <UsersRound className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold">
                  {hasRequestedFilters
                    ? "Completează ambele filtre"
                    : "Alege tratamentul și orașul"}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Căutarea pornește după ce selectezi un tratament și un oraș.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {hasInvalidFilter ? (
            <Card className="border-dashed bg-muted/15">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <SearchX className="mb-4 size-8 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Filtre indisponibile</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Tratamentul sau orașul din adresă nu există ori nu mai este
                  activ. Alege alte valori din formular.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {search && treatment && city ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {treatment.name} în {city.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {search.totalResults === 1
                      ? "1 student găsit"
                      : `${search.totalResults} studenți găsiți`}
                  </p>
                </div>
                {search.totalPages > 1 ? (
                  <p className="text-sm text-muted-foreground">
                    Pagina {search.page} din {search.totalPages}
                  </p>
                ) : null}
              </div>

              {search.results.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {search.results.map((student) => (
                    <PublicStudentResultCard
                      key={student.publicSlug}
                      student={student}
                      treatmentSlug={treatment.slug}
                      citySlug={city.slug}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed bg-muted/15">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <SearchX className="mb-4 size-8 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-lg font-semibold">
                      Nu există rezultate pentru aceste filtre
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                      Păstrează unul dintre filtre și încearcă alt tratament sau
                      alt oraș.
                    </p>
                  </CardContent>
                </Card>
              )}

              {search.totalPages > 1 ? (
                <nav
                  aria-label="Paginarea rezultatelor"
                  className="flex items-center justify-center gap-3"
                >
                  {page > 1 ? (
                    <Button asChild variant="outline">
                      <Link
                        href={resultsUrl(treatment.slug, city.slug, page - 1)}
                      >
                        Pagina anterioară
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      Pagina anterioară
                    </Button>
                  )}
                  {page < search.totalPages ? (
                    <Button asChild variant="outline">
                      <Link
                        href={resultsUrl(treatment.slug, city.slug, page + 1)}
                      >
                        Pagina următoare
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      Pagina următoare
                    </Button>
                  )}
                </nav>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
