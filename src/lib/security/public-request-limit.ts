import { isIP } from "node:net";

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 10_000;
const GLOBAL_CAPACITY = 100;
const GLOBAL_REQUESTS_PER_MINUTE = 1_200;
const CLIENT_CAPACITY = 30;
const CLIENT_REQUESTS_PER_MINUTE = 120;

type Bucket = { tokens: number; updatedAt: number };

function consume(bucket: Bucket, capacity: number, perMinute: number, now: number) {
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * perMinute / WINDOW_MS);
  bucket.updatedAt = Math.max(bucket.updatedAt, now);
  if (bucket.tokens < 1) {
    return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) * 60 / perMinute)) };
  }
  bucket.tokens -= 1;
  return { allowed: true as const, retryAfterSeconds: 0 };
}

export function isLimitedPublicRead(method: string, pathname: string) {
  if (method !== "GET" && method !== "HEAD") return false;
  try { pathname = decodeURIComponent(pathname); } catch { return false; }
  return pathname === "/" || pathname === "/sitemap.xml" ||
    /^\/studenti(?:\/|$)/.test(pathname) ||
    (pathname.startsWith("/api/studenti/") && /\/disponibilitati\/?$/.test(pathname));
}

// Enable this only for a header overwritten by the trusted reverse proxy.
// Without that configuration the global limit still applies; arbitrary
// X-Forwarded-For values never create new client buckets.
export function trustedPublicClientIp(headers: Headers, configuredHeader?: string) {
  const header = configuredHeader?.trim().toLowerCase();
  if (!header || !/^[a-z0-9-]{1,64}$/.test(header)) return null;
  const value = headers.get(header)?.trim();
  if (!value || value.includes(",") || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  try { return new URL(`http://[${value}]/`).hostname; } catch { return null; }
}

export class PublicRequestLimiter {
  private readonly clients = new Map<string, Bucket>();
  private global: Bucket | null = null;

  consume(clientIp: string | null, now = Date.now()) {
    if (clientIp) {
      const bucket = this.clients.get(clientIp) ?? { tokens: CLIENT_CAPACITY, updatedAt: now };
      const result = consume(bucket, CLIENT_CAPACITY, CLIENT_REQUESTS_PER_MINUTE, now);
      this.clients.delete(clientIp);
      this.clients.set(clientIp, bucket);
      if (this.clients.size > MAX_TRACKED_CLIENTS) {
        const oldest = this.clients.keys().next().value;
        if (oldest !== undefined) this.clients.delete(oldest);
      }
      if (!result.allowed) return result;
    }
    this.global ??= { tokens: GLOBAL_CAPACITY, updatedAt: now };
    return consume(this.global, GLOBAL_CAPACITY, GLOBAL_REQUESTS_PER_MINUTE, now);
  }
}

export function publicReadLimitResponse(request: Request, limiter: PublicRequestLimiter, trustedHeader?: string) {
  const pathname = new URL(request.url).pathname;
  if (!isLimitedPublicRead(request.method, pathname)) return null;
  const result = limiter.consume(trustedPublicClientIp(request.headers, trustedHeader));
  if (result.allowed) return null;
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": String(result.retryAfterSeconds),
    "X-Robots-Tag": "noindex, nofollow",
  };
  const error = "Prea multe cereri. Așteaptă puțin și încearcă din nou.";
  return decodeURIComponent(pathname).startsWith("/api/")
    ? Response.json({ error, code: "PUBLIC_RATE_LIMITED" }, { status: 429, headers })
    : new Response(error, { status: 429, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
}
