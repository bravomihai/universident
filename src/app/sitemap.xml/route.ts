import { isPublicDeployment } from "@/lib/seo/config";
import { publicSitemap, sitemapXml } from "@/lib/seo/discovery";
import { getSeoSearchCombinations, getSitemapStudentProfiles } from "@/lib/seo/public-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [profiles, combinations] = isPublicDeployment()
    ? await Promise.all([getSitemapStudentProfiles(), getSeoSearchCombinations()])
    : [[], []];
  return new Response(sitemapXml(publicSitemap(profiles, combinations)), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
