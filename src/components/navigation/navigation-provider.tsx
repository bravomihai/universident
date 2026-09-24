"use client";

import { Suspense, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createNavigationStore } from "@/lib/navigation/navigation-store";

export const browserNavigation = createNavigationStore({
  href: () => `${window.location.pathname}${window.location.search}${window.location.hash}`,
  state: () => window.history.state,
  replace: (state, href) => window.history.replaceState(state, "", href),
});
function serverSnapshot() { return null; }

function LocationObserver() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useLayoutEffect(() => { browserNavigation.sync(); }, [pathname, searchParams]);
  useLayoutEffect(() => {
    const restore = () => browserNavigation.sync(true);
    const updateHash = () => browserNavigation.sync();
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", restore);
    window.addEventListener("hashchange", updateHash);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("hashchange", updateHash);
    };
  }, []);
  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  return <>
    <Suspense fallback={null}><LocationObserver /></Suspense>
    {children}
  </>;
}

export function useNavigationEntry() {
  // A per-consumer server snapshot also keeps streamed boundaries hydration-safe.
  return useSyncExternalStore(browserNavigation.subscribe, browserNavigation.getSnapshot, serverSnapshot);
}
