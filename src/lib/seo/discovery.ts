import type { MetadataRoute } from "next";
import { canonicalUrl, isPublicDeployment } from "./config";
import type { SearchCombination } from "./search-combinations";

export function siteRobots(): MetadataRoute.Robots {
  if (!isPublicDeployment()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Let crawlers see noindex on auth/private URLs and /echipa.
    // Authentication remains authoritative; robots.txt is not access control.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}

export function publicSitemap(
  profiles: { publicSlug: string | null }[],
  combinations: SearchCombination[],
): MetadataRoute.Sitemap {
  if (!isPublicDeployment()) return [];
  const paths = new Set([
    "/", "/studenti",
    ...combinations.filter((entry) => entry.studentCount > 0).map((entry) => entry.href),
    ...profiles.filter((profile) => profile.publicSlug && !profile.publicSlug.startsWith("student-demo-"))
      .map((profile) => `/studenti/${encodeURIComponent(profile.publicSlug!)}`),
  ]);
  // Do not fabricate lastModified from crawl time or profile-only timestamps.
  return [...paths].map((path) => ({ url: canonicalUrl(path) }));
}

export function sitemapXml(entries: MetadataRoute.Sitemap) {
  const escape = (value: string) => value.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((entry) => `  <url><loc>${escape(entry.url)}</loc></url>`).join("\n") +
    "\n</urlset>\n";
}
