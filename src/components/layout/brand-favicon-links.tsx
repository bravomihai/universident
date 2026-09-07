import { brandAssets, brandThemes, faviconLinkId, faviconMedia } from "@/lib/branding/brand-assets";

export function BrandFaviconLinks() {
  return brandThemes.map((theme) => (
    <link
      key={theme}
      id={faviconLinkId(theme)}
      rel="icon"
      type="image/png"
      sizes="512x512"
      href={brandAssets[theme].favicon}
      media={faviconMedia(theme)}
    />
  ));
}
