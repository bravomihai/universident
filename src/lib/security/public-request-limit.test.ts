import assert from "node:assert/strict";
import test from "node:test";
import { isLimitedPublicRead, PublicRequestLimiter, publicReadLimitResponse, trustedPublicClientIp } from "./public-request-limit";

test("only expensive public reads are limited, including encoded route variants", () => {
  for (const path of ["/", "/studenti", "/studenti/student/programare/tratament/oras", "/%73tudenti/student", "/sitemap.xml", "/api/studenti/student/disponibilitati"]) {
    assert.equal(isLimitedPublicRead("GET", path), true, path);
    assert.equal(isLimitedPublicRead("HEAD", path), true, path);
    assert.equal(isLimitedPublicRead("POST", path), false, path);
  }
  for (const path of ["/api/health", "/api/auth/get-session", "/api/mesaje/necitite", "/cont/mesaje/chat", "/api/programari", "/_next/static/app.js", "/api/student-profile-images/photo", "/studenti-other"]) {
    assert.equal(isLimitedPublicRead("GET", path), false, path);
  }
});

test("client addresses require an explicitly configured trusted header", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.2", "x-real-ip": "192.0.2.1" });
  assert.equal(trustedPublicClientIp(headers), null);
  assert.equal(trustedPublicClientIp(headers, "x-real-ip"), "192.0.2.1");
  headers.set("x-real-ip", "192.0.2.1, 198.51.100.1");
  assert.equal(trustedPublicClientIp(headers, "x-real-ip"), null);
  headers.set("x-real-ip", "not-an-address");
  assert.equal(trustedPublicClientIp(headers, "x-real-ip"), null);
  headers.set("x-real-ip", "fe80::1%eth0");
  assert.equal(trustedPublicClientIp(headers, "x-real-ip"), null);
  const a = trustedPublicClientIp(new Headers({ "x-real-ip": "2001:db8:0:0:0:0:0:1" }), "x-real-ip");
  const b = trustedPublicClientIp(new Headers({ "x-real-ip": "2001:db8::1" }), "x-real-ip");
  assert.equal(a, b);
});

test("normal page bursts pass, abusive clients are isolated and tokens refill gradually", () => {
  const limiter = new PublicRequestLimiter();
  for (let i = 0; i < 30; i++) assert.equal(limiter.consume("192.0.2.1", 1000).allowed, true);
  assert.equal(limiter.consume("192.0.2.1", 1000).allowed, false);
  assert.equal(limiter.consume("192.0.2.2", 1000).allowed, true);
  assert.equal(limiter.consume("192.0.2.1", 1499).allowed, false);
  assert.equal(limiter.consume("192.0.2.1", 1500).allowed, true);
});

test("the global limit works without IP headers and cannot be evaded with new clients", () => {
  for (const withIps of [false, true]) {
    const limiter = new PublicRequestLimiter();
    for (let i = 0; i < 100; i++) assert.equal(limiter.consume(withIps ? `client-${i}` : null, 1000).allowed, true);
    assert.equal(limiter.consume(withIps ? "new-client" : null, 1000).allowed, false);
    assert.equal(limiter.consume(withIps ? "new-client" : null, 1050).allowed, true);
  }
});

test("429 responses are not cached and preserve JSON for availability requests", async () => {
  const limiter = new PublicRequestLimiter();
  for (let i = 0; i < 100; i++) limiter.consume(null, Date.now() + 1_000_000);
  const api = publicReadLimitResponse(new Request("http://localhost/api/studenti/student/disponibilitati"), limiter);
  assert.equal(api?.status, 429);
  assert.equal(api?.headers.get("cache-control"), "no-store");
  assert.ok(Number(api?.headers.get("retry-after")) >= 1);
  assert.equal((await api!.json()).code, "PUBLIC_RATE_LIMITED");
  const encodedApi = publicReadLimitResponse(new Request("http://localhost/%61pi/studenti/student/disponibilitati"), limiter);
  assert.equal((await encodedApi!.json()).code, "PUBLIC_RATE_LIMITED");
  const page = publicReadLimitResponse(new Request("http://localhost/studenti"), limiter);
  assert.equal(page?.status, 429);
  assert.match(page?.headers.get("content-type") ?? "", /text\/plain/);
  for (const path of ["/api/health", "/api/mesaje/necitite", "/api/auth/get-session"]) {
    assert.equal(publicReadLimitResponse(new Request(`http://localhost${path}`), limiter), null);
  }
  assert.equal(publicReadLimitResponse(new Request("http://localhost/api/studenti/student/programari", { method: "POST" }), limiter), null);
});
