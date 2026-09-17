import { isPublicDeployment } from "@/lib/seo/config";
import { serializeJsonLd, type StructuredData as StructuredDataValue } from "@/lib/seo/structured-data";

export function StructuredData({ data }: { data: StructuredDataValue | null }) {
  if (!data || !isPublicDeployment()) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
