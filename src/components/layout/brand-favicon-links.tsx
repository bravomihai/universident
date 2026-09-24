import {
  brandAssets,
  brandThemes,
  faviconLinkId,
  faviconMedia,
  shortcutBrandAssets,
} from "@/lib/branding/brand-assets";

export function BrandFaviconLinks() {
  return (
    <>
      {brandThemes.map((theme) => (
        <link
          key={theme}
          id={faviconLinkId(theme)}
          rel="icon"
          type="image/png"
          sizes="512x512"
          href={brandAssets[theme].favicon}
          media={faviconMedia(theme)}
        />
      ))}
      <link
        rel="apple-touch-icon"
        type={shortcutBrandAssets.apple.type}
        sizes={shortcutBrandAssets.apple.sizes}
        href={shortcutBrandAssets.apple.src}
      />
    </>
  );
}
