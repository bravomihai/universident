import type { Metadata } from "next";
import { publicStudentSearchHref } from "@/lib/public-students/public-student-search-pagination";
import { publicPageMetadata } from "./metadata";

export type StudentsQuery = Record<string, string | string[] | undefined>;
type CatalogOption = { name: string; slug: string };

export function parseStudentsQuery(params: StudentsQuery) {
  const single = (value: string | string[] | undefined) => typeof value === "string" ? value.trim() : "";
  const rawPage = params.pagina;
  const number = typeof rawPage === "string" && /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  const validPage = rawPage === undefined || (Number.isSafeInteger(number) && number >= 1);
  return {
    treatmentSlug: single(params.tratament),
    citySlug: single(params.oras),
    page: validPage && rawPage !== undefined ? number : 1,
    valid: validPage && !Array.isArray(params.tratament) && !Array.isArray(params.oras),
    hasFilters: params.tratament !== undefined || params.oras !== undefined,
  };
}

export function studentSearchMetadata(
  params: StudentsQuery,
  treatment: CatalogOption | undefined,
  city: CatalogOption | undefined,
  totalResults: number,
  pageSize: number,
): Metadata {
  const query = parseStudentsQuery(params);
  if (query.valid && treatment && city) {
    const suffix = query.page > 1 ? ` — pagina ${query.page}` : "";
    return publicPageMetadata({
      title: `${treatment.name} în ${city.name}${suffix}`,
      description: `${treatment.name} în ${city.name}, cu studenți la medicină dentară, sub supervizare. Consultă profilurile și orele disponibile.${query.page > 1 ? ` Pagina ${query.page}.` : ""}`,
      path: publicStudentSearchHref(treatment.slug, city.slug, query.page),
      indexable: totalResults > 0 && query.page <= Math.ceil(totalResults / pageSize),
    });
  }
  const isDirectory = query.valid && !query.hasFilters && query.page === 1;
  return publicPageMetadata({
    title: "Găsește studenți la medicină dentară în orașul tău",
    description: "Alege un tratament și un oraș pentru a găsi studenți la medicină dentară. Vezi profilurile și disponibilitatea pentru tratamente sub supervizare.",
    path: isDirectory ? "/studenti" : undefined,
    indexable: isDirectory,
  });
}
