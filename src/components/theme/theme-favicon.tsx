"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import { brandThemes, faviconLinkId, faviconMedia } from "@/lib/branding/brand-assets";

export function ThemeFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // These two persistent links are owned by the root layout. Updating their
    // media preserves the no-JS system fallback and avoids accumulating icons.
    for (const theme of brandThemes) {
      const icon = document.getElementById(faviconLinkId(theme));
      if (icon instanceof HTMLLinkElement) {
        icon.media = faviconMedia(theme, resolvedTheme);
      }
    }
  }, [resolvedTheme]);

  return null;
}
