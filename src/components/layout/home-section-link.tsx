"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { homeSectionHref } from "@/lib/navigation/home-section-href";

type HomeSectionLinkProps = Omit<ComponentProps<"a">, "href"> & {
  sectionId: string;
};

export function HomeSectionLink({ sectionId, children, ...props }: HomeSectionLinkProps) {
  const href = homeSectionHref(usePathname(), sectionId);

  // Native anchors re-scroll even when the current URL already has this hash.
  // They also preserve normal keyboard, modified-click and dropdown behaviour.
  return href.startsWith("#") ? (
    <a {...props} href={href}>{children}</a>
  ) : (
    <Link {...props} href={href}>{children}</Link>
  );
}
