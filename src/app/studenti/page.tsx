import { SearchX, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "@/components/navigation/app-link";

import { PublicStudentResultCard } from "@/components/public-students/public-student-result-card";
import { PublicStudentSearchForm } from "@/components/public-students/public-student-search-form";
import { PublicStudentPagination } from "@/components/public-students/public-student-pagination";
import { PublicSearchLinks } from "@/components/public-students/public-search-links";
import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { publicStudentSearchHref } from "@/lib/public-students/public-student-search-pagination";
import {
  getPublicStudentCatalog,
  searchPublicStudents,
  PUBLIC_STUDENTS_PAGE_SIZE,
} from "@/lib/public-students/public-student-service";
import { parseStudentsQuery, studentSearchMetadata } from "@/lib/seo/student-search";
import { getSeoSearchCombinations } from "@/lib/seo/public-data";
import { StructuredData } from "@/components/seo/structured-data";
import { studentSearchStructuredData } from "@/lib/seo/structured-data";
import { studentSearchIntroduction } from "@/lib/seo/public-answers";

type StudentsPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type StudentsPageProps = {
  searchParams: StudentsPageSearchParams;
};

export async function generateMetadata({
  searchParams,
}: StudentsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const { treatmentSlug, citySlug, valid } = parseStudentsQuery(params);
  const catalog = await getPublicStudentCatalog();
  const treatment = catalog.treatments.find(
    (option) => option.slug === treatmentSlug,
  );
  const city = catalog.cities.find((option) => option.slug === citySlug);

  const combinations = valid && treatment && city
    ? await getSeoSearchCombinations(treatment.slug, city.slug)
    : [];
  const count = combinations.find((entry) => entry.treatment.slug === treatmentSlug && entry.city.slug === citySlug)?.studentCount ?? 0;
  return studentSearchMetadata(params, treatment, city, count, PUBLIC_STUDENTS_PAGE_SIZE);
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const [params, session] = await Promise.all([
    searchParams,
    auth.api.getSession({ headers: await headers() }),
  ]);
  const { treatmentSlug: requestedTreatmentSlug, citySlug: requestedCitySlug, page } = parseStudentsQuery(params);
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
          excludedUserId:
            session?.user.role === UserRole.STUDENT
              ? session.user.id
              : undefined,
        })
      : null;

  if (search && page > search.totalPages) {
    redirect(publicStudentSearchHref(treatment!.slug, city!.slug, search.totalPages));
  }

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <StructuredData data={session ? null : studentSearchStructuredData({
        params, treatment, city, results: search?.results ?? [], pageSize: PUBLIC_STUDENTS_PAGE_SIZE,
      })} />
      <div className="w-full max-w-6xl space-y-8">
        <header className="app-page-heading max-w-3xl space-y-3">
          <p className="app-eyebrow">ÎNGRIJIRE, APROAPE DE TINE</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {treatment && city ? `${treatment.name} în ${city.name}` : "Găsește tratamentul potrivit în orașul tău"}
          </h1>
          <p className="text-muted-foreground">
            {studentSearchIntroduction(treatment, city, Boolean(search?.totalResults))}
          </p>
        </header>

        <PublicStudentSearchForm
          treatments={catalog.treatments}
          cities={catalog.cities}
          selectedTreatmentSlug={treatment?.slug ?? ""}
          selectedCitySlug={city?.slug ?? ""}
        />

        {!hasRequestedFilters && !hasInvalidFilter ? <PublicSearchLinks /> : null}

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
                    <div key={student.publicSlug} className="flex flex-col gap-2">
                      <PublicStudentResultCard student={student} treatmentSlug={treatment.slug} />
                      <Link
                        href={`/studenti/${encodeURIComponent(student.publicSlug)}`}
                        prefetch={false}
                        className="text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        Vezi profilul: {student.name} <span aria-hidden="true">&gt;</span>
                      </Link>
                    </div>
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

              <PublicStudentPagination
                page={search.page}
                totalPages={search.totalPages}
                treatmentSlug={treatment.slug}
                citySlug={city.slug}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
