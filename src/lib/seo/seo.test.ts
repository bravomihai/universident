import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { canonicalUrl, isPublicDeployment, robotsHeader } from "./config";
import { homeMetadata, studentProfileMetadata } from "./metadata";
import { parseStudentsQuery, studentSearchMetadata } from "./student-search";
import { publicSitemap, siteRobots, sitemapXml } from "./discovery";
import { bookableSearchCombinations, type SeoAvailabilityBlock } from "./search-combinations";

const environments = new WeakMap<TestContext, Record<string, string | undefined>>();
function setEnv(t: TestContext, name: string, value: string) {
  let original = environments.get(t);
  if (!original) {
    original = {};
    environments.set(t, original);
    const saved = original;
    t.after(() => {
      for (const [key, previous] of Object.entries(saved)) {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      }
    });
  }
  if (!Object.hasOwn(original, name)) original[name] = process.env[name];
  process.env[name] = value;
}

const publicEnv = { DEPLOYMENT_ENV: "production", BETTER_AUTH_URL: "https://universident.ro" };
const treatment = { name: "Igienizare dentară", slug: "igienizare" };
const city = { name: "Cluj-Napoca", slug: "cluj-napoca" };
const query = { tratament: treatment.slug, oras: city.slug };

test("production needs an explicit public deployment and the confirmed HTTPS origin", () => {
  assert.equal(isPublicDeployment(publicEnv), true);
  for (const env of [
    {}, { BETTER_AUTH_URL: publicEnv.BETTER_AUTH_URL },
    { ...publicEnv, DEPLOYMENT_ENV: "development" },
    { ...publicEnv, DEPLOYMENT_ENV: "staging" },
    { ...publicEnv, VERCEL_ENV: "preview" },
    { ...publicEnv, BETTER_AUTH_URL: "https://staging.universident.ro" },
    { ...publicEnv, BETTER_AUTH_URL: "http://localhost:3000" },
  ]) assert.equal(isPublicDeployment(env), false);
  assert.equal(robotsHeader("/", "staging.universident.ro", publicEnv), "noindex, nofollow");
  assert.equal(robotsHeader("/", "universident.ro", publicEnv), null);
  assert.equal(canonicalUrl("/studenti"), "https://universident.ro/studenti");
  assert.throws(() => canonicalUrl("//staging.universident.ro/"));
  assert.throws(() => canonicalUrl("/\\staging.universident.ro/"));
});

test("private pages, auth variants, APIs and booking flows receive noindex even on redirects", () => {
  for (const path of ["/cont", "/cont/mesaje/abcdef", "/cont/programari/123", "/pacienti/slug",
    "/autentificare", "/inregistrare", "/parola-uitata", "/resetare-parola", "/verifica-email",
    "/api/auth/callback", "/studenti/ana/programare/igienizare/cluj-napoca",
  ]) assert.equal(robotsHeader(path, "universident.ro", publicEnv), "noindex, nofollow", path);
  for (const path of ["/", "/studenti", "/studenti/ana", "/echipa"])
    assert.equal(robotsHeader(path, "universident.ro", publicEnv), null, path);
});

test("Romanian metadata and canonicals retain distinct combinations and pagination", (t) => {
  setEnv(t, "DEPLOYMENT_ENV", "production");
  setEnv(t, "BETTER_AUTH_URL", publicEnv.BETTER_AUTH_URL);
  setEnv(t, "VERCEL_ENV", "production");
  assert.equal(homeMetadata().alternates?.canonical, "https://universident.ro/");
  assert.match(String(homeMetadata().description), /sub supervizare/);
  const page1 = studentSearchMetadata(query, treatment, city, 25, 12);
  const page2 = studentSearchMetadata({ ...query, pagina: "2" }, treatment, city, 25, 12);
  assert.equal(page1.alternates?.canonical, "https://universident.ro/studenti?tratament=igienizare&oras=cluj-napoca");
  assert.equal(page2.alternates?.canonical, `${page1.alternates?.canonical}&pagina=2`);
  assert.match(String(page2.title), /pagina 2/);
  assert.deepEqual(page2.robots, { index: true, follow: true });
  const otherCity = { name: "Iași", slug: "iasi" };
  assert.notEqual(studentSearchMetadata({ ...query, oras: "iasi" }, treatment, otherCity, 1, 12).alternates?.canonical, page1.alternates?.canonical);
  for (const params of [{ ...query, pagina: "1" }, { ...query, pagina: "01" }, { ...query, utm_source: "mail", sortare: "ignorat" }]) {
    assert.equal(studentSearchMetadata(params, treatment, city, 25, 12).alternates?.canonical, page1.alternates?.canonical);
  }
  assert.equal(studentSearchMetadata({ utm_source: "mail" }, undefined, undefined, 0, 12).alternates?.canonical, "https://universident.ro/studenti");
});

test("empty, partial, invalid and out-of-range results are not indexable", (t) => {
  setEnv(t, "DEPLOYMENT_ENV", "production");
  setEnv(t, "BETTER_AUTH_URL", publicEnv.BETTER_AUTH_URL);
  const results = [
    studentSearchMetadata(query, treatment, city, 0, 12),
    studentSearchMetadata({ ...query, pagina: "4" }, treatment, city, 25, 12),
    studentSearchMetadata({ tratament: treatment.slug }, treatment, undefined, 0, 12),
    studentSearchMetadata({ oras: "necunoscut" }, undefined, undefined, 0, 12),
    studentSearchMetadata({ pagina: "2" }, undefined, undefined, 0, 12),
    ...["0", "-1", "1.5", "text", "9007199254740992", ["1", "2"]].map((pagina) =>
      studentSearchMetadata({ ...query, pagina }, treatment, city, 25, 12)),
    studentSearchMetadata({ ...query, tratament: ["igienizare", "consultatie"] }, undefined, city, 25, 12),
  ];
  for (const metadata of results) assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(results[2].alternates, undefined);
  assert.deepEqual(parseStudentsQuery({ ...query, pagina: ["1", "2"] }), {
    treatmentSlug: treatment.slug, citySlug: city.slug, page: 1, valid: false, hasFilters: true,
  });
});

test("published profile metadata uses a clean profile canonical and no private data", (t) => {
  setEnv(t, "DEPLOYMENT_ENV", "production");
  setEnv(t, "BETTER_AUTH_URL", publicEnv.BETTER_AUTH_URL);
  const metadata = studentProfileMetadata({ publicSlug: "ana-popescu", university: "UMF Cluj-Napoca", studyYear: 4, user: { name: "Ana Popescu" } });
  assert.equal(metadata.alternates?.canonical, "https://universident.ro/studenti/ana-popescu");
  assert.match(String(metadata.description), /Ana Popescu, student în anul 4/);
  assert.deepEqual(studentProfileMetadata(null).robots, { index: false, follow: false });
  assert.equal(studentProfileMetadata(null).alternates, undefined);
});

const now = new Date("2026-09-17T06:00:00Z");
const through = new Date("2026-11-16T06:00:00Z");
function block(overrides: Partial<SeoAvailabilityBlock> = {}): SeoAvailabilityBlock {
  return {
    id: "block", studentProfileId: "student-1",
    startsAt: new Date("2026-09-18T08:00:00Z"), endsAt: new Date("2026-09-18T10:00:00Z"),
    studentLocation: { city },
    offerings: [{ id: "offering", studentTreatment: { durationMinutes: 60, treatment } }],
    appointments: [], ...overrides,
  };
}

test("discovery uses actual contiguous free capacity and deduplicates students across locations", () => {
  const available = block();
  const occupied = block({ studentProfileId: "full", appointments: [{ scheduledStartsAt: available.startsAt, scheduledEndsAt: available.endsAt }] });
  const fragmented = block({ studentProfileId: "fragmented", appointments: [{ scheduledStartsAt: new Date("2026-09-18T08:30:00Z"), scheduledEndsAt: new Date("2026-09-18T09:30:00Z") }] });
  const past = block({ startsAt: new Date("2026-09-10T08:00:00Z"), endsAt: new Date("2026-09-10T10:00:00Z") });
  const farFuture = block({ startsAt: new Date("2027-01-01T08:00:00Z"), endsAt: new Date("2027-01-01T10:00:00Z") });
  assert.deepEqual(bookableSearchCombinations([occupied, fragmented, past, farFuture], now, through), []);
  const entries = bookableSearchCombinations([available, block({ id: "second-location" }), block({ studentProfileId: "student-2" }), occupied], now, through);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].studentCount, 2);
  assert.equal(entries[0].href, "/studenti?tratament=igienizare&oras=cluj-napoca");
});

test("sitemap contains only canonical public destinations; staging publishes none", (t) => {
  setEnv(t, "DEPLOYMENT_ENV", "production");
  setEnv(t, "BETTER_AUTH_URL", publicEnv.BETTER_AUTH_URL);
  setEnv(t, "VERCEL_ENV", "production");
  const entries = bookableSearchCombinations([block()], now, through);
  const sitemap = publicSitemap([{ publicSlug: "ana-popescu" }, { publicSlug: "student-demo-001" }, { publicSlug: null }], entries);
  assert.deepEqual(sitemap.map((entry) => entry.url), [
    "https://universident.ro/", "https://universident.ro/studenti",
    "https://universident.ro/studenti?tratament=igienizare&oras=cluj-napoca",
    "https://universident.ro/studenti/ana-popescu",
  ]);
  assert.equal(siteRobots().sitemap, "https://universident.ro/sitemap.xml");
  assert.match(sitemapXml(sitemap), /tratament=igienizare&amp;oras=cluj-napoca/);
  assert.doesNotMatch(sitemapXml(sitemap), /&(?!amp;|lt;|gt;|quot;|apos;)/);
  // noindex pages remain crawlable so Google can read their directives.
  assert.deepEqual(siteRobots().rules, { userAgent: "*", allow: "/", disallow: "/api/" });
  setEnv(t, "DEPLOYMENT_ENV", "staging");
  assert.deepEqual(publicSitemap([{ publicSlug: "ana-popescu" }], entries), []);
  assert.deepEqual(siteRobots(), { rules: { userAgent: "*", disallow: "/" } });
  assert.deepEqual(homeMetadata().robots, { index: false, follow: true });
});
