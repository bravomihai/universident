import type { MetadataRoute } from "next";

import { shortcutBrandAssets } from "@/lib/branding/brand-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Universident",
    short_name: "Universident",
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#E3EFFF",
    theme_color: "#E3EFFF",
    icons: shortcutBrandAssets.icons.map((icon) => ({ ...icon, purpose: "any" })),
  };
}
