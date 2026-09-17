import { canonicalUrl } from "./config";
import { platformDescription, studentSearchIntroduction, studentStudyDescription } from "./public-answers";
import { parseStudentsQuery, type StudentsQuery } from "./student-search";
import { publicStudentSearchHref } from "@/lib/public-students/public-student-search-pagination";

export type StructuredData = Record<string, unknown>;
const websiteId = canonicalUrl("/#website");

export function serializeJsonLd(data: StructuredData) {
  // Names may contain HTML. JSON.stringify alone does not escape </script>.
  const escaped: Record<string, string> = {
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029",
  };
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (character) => escaped[character]);
}

export function homeStructuredData(): StructuredData {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite", "@id": websiteId, url: canonicalUrl("/"),
        name: "Universident", inLanguage: "ro-RO", description: platformDescription,
      },
      {
        "@type": "WebPage", "@id": canonicalUrl("/#webpage"), url: canonicalUrl("/"),
        name: "Universident — tratamente dentare cu studenți, sub supervizare",
        inLanguage: "ro-RO", description: platformDescription, isPartOf: { "@id": websiteId },
      },
    ],
  };
}

// Only the narrow, publicly eligible SEO projection is passed by the page.
// No patient reviews, account identifiers or appointment data are serialized.
export function studentProfileStructuredData(profile: {
  publicSlug: string | null;
  university: string;
  studyYear: number;
  user: { name: string };
} | null): StructuredData | null {
  if (!profile?.publicSlug) return null;
  const url = canonicalUrl(`/studenti/${encodeURIComponent(profile.publicSlug)}`);
  return {
    "@context": "https://schema.org", "@type": "ProfilePage", "@id": `${url}#profile`,
    url, name: profile.user.name, inLanguage: "ro-RO", isPartOf: { "@id": websiteId },
    mainEntity: {
      "@type": "Person", "@id": `${url}#student`, url, name: profile.user.name,
      description: studentStudyDescription(profile.university, profile.studyYear),
    },
  };
}

export function studentSearchStructuredData({ params, treatment, city, results, pageSize }: {
  params: StudentsQuery;
  treatment?: { name: string; slug: string };
  city?: { name: string; slug: string };
  results: { publicSlug: string; name: string }[];
  pageSize: number;
}): StructuredData | null {
  const query = parseStudentsQuery(params);
  if (!query.valid) return null;
  const isDirectory = !query.hasFilters && query.page === 1;
  if (!isDirectory && (!treatment || !city || !results.length)) return null;
  const path = isDirectory ? "/studenti" : publicStudentSearchHref(treatment!.slug, city!.slug, query.page);
  const url = canonicalUrl(path);
  return {
    "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${url}#page`,
    url, inLanguage: "ro-RO", isPartOf: { "@id": websiteId },
    name: isDirectory ? "Găsește tratamentul potrivit în orașul tău" : `${treatment!.name} în ${city!.name}${query.page > 1 ? ` — pagina ${query.page}` : ""}`,
    description: studentSearchIntroduction(treatment, city, !isDirectory),
    ...(!isDirectory ? { mainEntity: {
      "@type": "ItemList",
      itemListElement: results.map((student, index) => ({
        "@type": "ListItem", position: (query.page - 1) * pageSize + index + 1,
        name: student.name, url: canonicalUrl(`/studenti/${encodeURIComponent(student.publicSlug)}`),
      })),
    } } : {}),
  };
}
