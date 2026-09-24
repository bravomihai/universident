import { cleanNavigationHref, navigationSource, nextNavigationEntry, readNavigationEntry, type NavigationEntry, type NavigationMode } from "./return-navigation";

export const NAVIGATION_STATE_KEY = "universidentNavigation";
type HistoryBridge = {
  href: () => string;
  state: () => Record<string, unknown> | null;
  replace: (state: Record<string, unknown>, href?: string) => void;
};

// State belongs to a history entry, never a global map keyed by URL. Two visits
// to the same appointment can therefore have different return destinations.
export function createNavigationStore(history: HistoryBridge) {
  let snapshot: NavigationEntry | null = null;
  let pending: { from: string | null; entry: NavigationEntry | null } | null = null;
  const listeners = new Set<() => void>();

  function sync(restored = false) {
    if (restored) pending = null;
    const originalHref = history.href();
    const href = cleanNavigationHref(originalHref);
    const source = navigationSource(href);
    const state = history.state() ?? {};
    const saved = readNavigationEntry(state[NAVIGATION_STATE_KEY], href);
    const arrived = pending?.entry?.href === source;
    const next = arrived ? pending!.entry : saved
      ?? (!restored && snapshot ? readNavigationEntry(snapshot, href) : null)
      ?? nextNavigationEntry(href, null);
    if (arrived || (pending && source !== pending.from)) pending = null;

    if (JSON.stringify(state[NAVIGATION_STATE_KEY] ?? null) !== JSON.stringify(next) || originalHref !== href) {
      const updated = { ...state };
      if (next) updated[NAVIGATION_STATE_KEY] = next;
      else delete updated[NAVIGATION_STATE_KEY];
      // Preserve Next.js's own state, and do not create an extra history entry.
      try { history.replace(updated, originalHref !== href ? href : undefined); }
      catch { /* In-memory navigation still works if history writes are unavailable. */ }
    }
    if (JSON.stringify(snapshot) !== JSON.stringify(next)) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    sync,
    prepare(href: string, mode: NavigationMode = "forward") {
      sync();
      const cleanHref = cleanNavigationHref(href);
      const entry = nextNavigationEntry(cleanHref, snapshot, mode);
      pending = entry && entry.href !== snapshot?.href ? { from: snapshot?.href ?? null, entry } : null;
      return cleanHref;
    },
  };
}
