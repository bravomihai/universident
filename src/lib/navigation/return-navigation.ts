// Presentation state only. Destination pages still authorize every private read.
const ORIGIN = "https://universident.invalid";
const MAX_STEPS = 8;
const MAX_HREF_LENGTH = 1024;
const UI_QUERY_KEYS = new Set(["tratament", "oras", "pagina", "locatie", "trecute"]);
const AUTH_PATHS = new Set(["/autentificare", "/inregistrare", "/verifica-email", "/parola-uitata", "/resetare-parola"]);

export type NavigationMode = "forward" | "replace" | "reset" | "none" | "back";
export type NavigationEntry = { href: string; trail: string[] };

function internalUrl(href: string): URL | null {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000-\u0020]/u.test(href)) return null;
  try {
    const url = new URL(href, ORIGIN);
    if (url.origin !== ORIGIN || /%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f])/i.test(url.pathname)) return null;
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || AUTH_PATHS.has(url.pathname.replace(/\/$/, ""))) return null;
    return url;
  } catch { return null; }
}
function relativeHref(url: URL) { return `${url.pathname}${url.search}${url.hash}`; }

// Remove obsolete navigation metadata from old bookmarks; never interpret it.
export function cleanNavigationHref(href: string): string {
  const url = internalUrl(href);
  if (!url || (!url.searchParams.has("inapoi") && !url.searchParams.has("sursa"))) return href;
  url.searchParams.delete("inapoi");
  url.searchParams.delete("sursa");
  return relativeHref(url);
}

// Only UI filters travel back; tokens, email addresses and free text do not.
export function navigationSource(href: string): string | null {
  const url = internalUrl(href);
  if (!url) return null;
  const clean = new URL(url.pathname, ORIGIN);
  for (const [key, value] of url.searchParams) {
    if (UI_QUERY_KEYS.has(key) && /^[\p{L}\p{N}_-]{1,128}$/u.test(value)) clean.searchParams.set(key, value);
  }
  if (/^#[\p{L}\p{N}_-]{1,128}$/u.test(url.hash)) clean.hash = url.hash;
  const result = relativeHref(clean);
  return result.length <= MAX_HREF_LENGTH ? result : null;
}

export function readNavigationEntry(value: unknown, currentHref: string): NavigationEntry | null {
  const current = navigationSource(currentHref);
  if (!current || !value || typeof value !== "object") return null;
  const entry = value as Partial<NavigationEntry>;
  if (typeof entry.href !== "string" || navigationSource(entry.href) !== entry.href) return null;
  // Native section anchors can copy the current history state with a new hash.
  if (entry.href.split("#")[0] !== current.split("#")[0]) return null;
  if (!Array.isArray(entry.trail) || entry.trail.length > MAX_STEPS) return null;
  const paths = new Set([new URL(current, ORIGIN).pathname]);
  for (const step of entry.trail) {
    if (typeof step !== "string" || step.length > MAX_HREF_LENGTH || navigationSource(step) !== step) return null;
    const path = new URL(step, ORIGIN).pathname;
    if (paths.has(path)) return null;
    paths.add(path);
  }
  return { href: current, trail: [...entry.trail] };
}

export function nextNavigationEntry(href: string, previous: NavigationEntry | null, mode: NavigationMode = "forward"): NavigationEntry | null {
  const destination = navigationSource(href);
  if (!destination) return null;
  const current = previous ? readNavigationEntry(previous, previous.href) : null;
  const path = new URL(destination, ORIGIN).pathname;
  if (!current || mode === "reset" || mode === "none" || path === "/" || path === "/cont") return { href: destination, trail: [] };
  if (path === new URL(current.href, ORIGIN).pathname) return { href: destination, trail: current.trail };
  const ancestor = current.trail.findIndex((step) => new URL(step, ORIGIN).pathname === path);
  if (ancestor >= 0) return { href: destination, trail: current.trail.slice(0, ancestor) };
  if (mode === "back") return { href: destination, trail: [] };
  return { href: destination, trail: (mode === "replace" ? current.trail : [...current.trail, current.href]).slice(-MAX_STEPS) };
}

export function navigationBackLabel(href: string): string {
  const path = internalUrl(href)?.pathname;
  const labels: Record<string, string> = {
    "/": "Înapoi la pagina principală",
    "/studenti": "Înapoi la rezultate",
    "/echipa": "Înapoi la echipă",
    "/cont": "Înapoi la cont",
    "/cont/programari": "Înapoi la programări",
    "/cont/arhivate": "Înapoi la programările arhivate",
    "/cont/calendar": "Înapoi la calendar",
    "/cont/mesaje": "Înapoi la mesaje",
    "/cont/mesaje/despre-verificare": "Înapoi la verificarea mesajelor",
    "/cont/profil-pacient": "Înapoi la profil",
    "/cont/profil-student": "Înapoi la profil",
    "/cont/tratamente": "Înapoi la tratamente",
    "/cont/locatii": "Înapoi la locații",
    "/cont/supervizori": "Înapoi la supervizori",
    "/cont/resurse-arhivate": "Înapoi la resursele arhivate",
    "/cont/securitate": "Înapoi la securitatea contului",
  };
  if (!path) return "Înapoi";
  if (labels[path]) return labels[path];
  if (/^\/cont\/mesaje\/[^/]+$/.test(path)) return "Înapoi la mesaje";
  if (/^\/cont\/programari\/[^/]+$/.test(path)) return "Înapoi la programare";
  if (/^\/studenti\/[^/]+\/programare\//.test(path)) return "Înapoi la calendarul de programare";
  if (/^\/(?:studenti|pacienti)\/[^/]+$/.test(path)) return "Înapoi la profil";
  return "Înapoi";
}

export function contextualBackLink(entry: NavigationEntry | null) {
  const valid = entry ? readNavigationEntry(entry, entry.href) : null;
  const href = valid?.trail.at(-1) ?? "/";
  return { href, label: navigationBackLabel(href) };
}
