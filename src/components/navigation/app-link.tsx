"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cleanNavigationHref, type NavigationMode } from "@/lib/navigation/return-navigation";
import { browserNavigation } from "./navigation-provider";

type AppLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: string;
  navigation?: NavigationMode;
};

export default function AppLink({ href, navigation, replace, onNavigate, ...props }: AppLinkProps) {
  const destination = cleanNavigationHref(href);
  return <NextLink {...props} href={destination} replace={replace} onNavigate={(event) => {
    let cancelled = false;
    onNavigate?.({ preventDefault() { cancelled = true; event.preventDefault(); } });
    // Next calls onNavigate only for actual same-tab navigations, after onClick.
    // Cancelled clicks, downloads, prefetches and new tabs do not change context.
    if (!cancelled) browserNavigation.prepare(destination, navigation ?? (replace ? "replace" : "forward"));
  }} />;
}
