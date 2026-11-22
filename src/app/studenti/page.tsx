import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "@/components/navigation/app-link";

import { PublicStudentDirectoryGrid } from "@/components/public-students/public-student-directory-grid";
import { PublicStudentDirectorySort } from "@/components/public-students/public-student-directory-sort";
import { PublicStudentResultCard } from "@/components/public-students/public-student-result-card";
import { PublicStudentSearchForm } from "@/components/public-students/public-student-search-form";
import { PublicStudentPagination } from "@/components/public-students/public-student-pagination";
import { PublicSearchLinks } from "@/components/public-students/public-search-links";
import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { listPublicStudentDirectory } from "@/lib/public-students/public-student-directory";
import { parseStudentDirectorySort, publicStudentCountLabel, publicStudentDirectoryHref } from "@/lib/public-students/public-student-directory-order";
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
import { cn } from "@/lib/utils";

import studentCardLayout from "@/components/public-students/public-student-card-layout.module.css";

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
  const sort = parseStudentDirectorySort(params.sortare);
  const excludedUserId = session?.user.role === UserRole.STUDENT ? session.user.id : undefined;
  const directory = !hasRequestedFilters && !hasInvalidFilter
    ? await listPublicStudentDirectory({ page, sort, excludedUserId })
    : null;

  const search =
    treatment && city && !hasInvalidFilter
      ? await searchPublicStudents({
          treatmentSlug: treatment.slug,
          citySlug: city.slug,
          page,
          excludedUserId,
        })
      : null;

  if (directory && page > directory.totalPages) {
    redirect(publicStudentDirectoryHref(directory.totalPages, sort));
  }

  if (search && page > search.totalPages) {
    redirect(publicStudentSearchHref(treatment!.slug, city!.slug, search.totalPages));
  }

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <StructuredData data={session ? null : studentSearchStructuredData({
        params, treatment, city, results: search?.results ?? [], pageSize: PUBLIC_STUDENTS_PAGE_SIZE,
      })} />
      <div className="w-full max-w-6xl space-y-6 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {treatment && city ? `${treatment.name} în ${city.name}` : "Studenți înscriși"}
          </h1>
        </header>

        <PublicStudentSearchForm
          key={`${treatment?.slug ?? ""}/${city?.slug ?? ""}`}
          treatments={catalog.treatments}
          cities={catalog.cities}
          selectedTreatmentSlug={treatment?.slug ?? ""}
          selectedCitySlug={city?.slug ?? ""}
        />

        {directory ? (
          <section aria-label="Studenți înscriși" className="space-y-5">
            {directory.results.length > 0 ? (
              <>
                <div className="card-adjacent heading-actions flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {publicStudentCountLabel(directory.totalResults)}
                  </p>
                  <PublicStudentDirectorySort sort={sort} />
                </div>
                <PublicStudentDirectoryGrid students={directory.results} />
                <PublicStudentPagination page={page} totalPages={directory.totalPages} sort={sort} />
              </>
            ) : (
              <Card className="border-dashed bg-muted/15">
                <CardContent className="py-6 text-center text-muted-foreground">Momentan nu există profiluri publicate.</CardContent>
              </Card>
            )}
          </section>
        ) : null}

        <section aria-live="polite" aria-atomic="false">
          {hasRequestedFilters && !hasCompleteSelection && !hasInvalidFilter ? (
            <p className="card-adjacent text-sm text-muted-foreground">Completează ambele filtre.</p>
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
              {search.totalResults > 0 ? (
                <div className="card-adjacent heading-actions flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    {publicStudentCountLabel(search.totalResults, true)}
                  </h2>
                  {search.totalPages > 1 ? (
                    <p className="text-sm text-muted-foreground">
                      Pagina {search.page} din {search.totalPages}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {search.results.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {search.results.map((student) => (
                    <div key={student.publicSlug} className={cn("flex flex-col gap-2", studentCardLayout.searchItem)}>
                      <PublicStudentResultCard student={student} treatmentSlug={treatment.slug} />
                      <Link
                        href={`/studenti/${encodeURIComponent(student.publicSlug)}`}
                        prefetch={false}
                        className={cn("card-adjacent text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4", studentCardLayout.searchProfileLink)}
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
        {directory && page === 1 && sort === "recent" ? <PublicSearchLinks /> : null}
      </div>
    </main>
  );
}
