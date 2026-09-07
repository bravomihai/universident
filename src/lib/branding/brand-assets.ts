export const brandThemes = ["light", "dark"] as const;
export type BrandTheme = (typeof brandThemes)[number];

export const brandAssets = {
  light: {
    header: "/branding/universident-header-light.png",
    logo: "/branding/universident-logo-light.png",
    favicon: "/branding/favicon-light.png",
  },
  dark: {
    header: "/branding/universident-header-dark.png",
    logo: "/branding/universident-logo-dark.png",
    favicon: "/branding/favicon-dark.png",
  },
} as const;

// Before hydration (and without JS), the browser follows its system theme.
// Afterwards the explicit application theme takes precedence over the OS.
export function faviconMedia(variant: BrandTheme, resolvedTheme?: string) {
  if (resolvedTheme === "light" || resolvedTheme === "dark") {
    return variant === resolvedTheme ? "all" : "not all";
  }
  return `(prefers-color-scheme: ${variant})`;
}

export function faviconLinkId(theme: BrandTheme) {
  return `universident-favicon-${theme}`;
}
