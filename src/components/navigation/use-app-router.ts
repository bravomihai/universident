"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { browserNavigation } from "./navigation-provider";

export function useRouter() {
  const router = useNextRouter();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) =>
      router.push(browserNavigation.prepare(href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
      router.replace(browserNavigation.prepare(href, "replace"), options),
  }), [router]);
}
