# Search indexing and discovery

## Environment

The canonical origin is `https://universident.ro`, defined in [`src/lib/seo/config.ts`](../src/lib/seo/config.ts). SEO URLs never derive from request hosts, localhost, or preview addresses. Indexing requires all three conditions:

- `DEPLOYMENT_ENV=production`;
- `BETTER_AUTH_URL=https://universident.ro`, with no trailing slash;
- `VERCEL_ENV` absent or equal to `production`.

An absent deployment flag disables indexing even when `NODE_ENV=production`. Use `development` or `staging` in non-public environments. Production Compose passes `DEPLOYMENT_ENV` with a safe default of `staging`; dynamic SEO routes read runtime configuration, so test build values do not enable public indexing.

The Next.js proxy adds `X-Robots-Tag: noindex, nofollow` outside the public environment and for hosts other than `universident.ro`. Preserve the public `Host` header in the reverse proxy. Non-public environments also serve `Disallow: /` and an empty sitemap.

## Canonical URLs and eligibility

| Page | Public indexing | Canonical URL |
| --- | --- | --- |
| `/` and `/studenti` | Allowed | The corresponding public URL |
| Active treatment/city search with bookable capacity | Allowed | `/studenti?tratament=…&oras=…` |
| Valid results page after page one | Allowed | The same search with `&pagina=N` |
| Search without bookable capacity | Disabled | That search URL |
| Incomplete, unknown, or repeated filters; invalid pagination | Disabled | No canonical pointing to unrelated results |
| Eligible public profile | Allowed | `/studenti/<slug>`, without context parameters |
| Unpublished, unverified, or missing profile | Disabled; remains 404 | None |
| Demo profile | Disabled | None |
| Account, chat, patient, authentication, and booking pages | Disabled | No inherited public canonical |

Canonical URLs omit ignored parameters such as UTM tags, use stable filter ordering, and omit `pagina=1`. Later valid pages retain their own canonical and numbered title. Out-of-range pages temporarily redirect to the last available page, including page one for empty searches. Invalid filters remain editable in the form and receive `noindex`.

Metadata is Romanian and describes supervised student care without unsupported claims about qualifications or outcomes. `metadataBase` is scoped to SEO pages; `/echipa` retains its separate metadata.

## Sitemap and internal links

The sitemap includes the homepage, directory, first page of eligible searches, and published student profiles that satisfy existing visibility rules: STUDENT role, verified email, university, valid study year, and public slug. It excludes `/echipa`, private/authentication/booking pages, fixtures, and searches without real capacity. Pagination links expose subsequent result pages.

Fixture detection covers `student-demo-*` slugs, `demo-ui-*` IDs, the demo email domain, and associations with the original demo slots/supervisors. Public search and recent-profile lists also exclude these profiles without modifying their records.

Search discovery uses real capacity in the 60-day booking window, treatment duration, and the existing calendar slicing algorithm after confirmed appointments and unexpired requests are subtracted. It does not generate a Cartesian product of cities and treatments. Results retain booking links and direct public-profile links.

SEO queries are read-only with narrow selections and no private DTOs. They do not materialize recurring availability: combinations without materialized capacity are conservatively omitted until normal calendar/search flows create it. Sitemap XML escapes special characters, omits invented `lastmod` values, and disables caching to reflect withdrawals and capacity changes.

Production robots.txt allows crawlers to read HTML `noindex` directives and excludes `/api/`. Private pages also receive restrictive metadata and HTTP headers, including authentication redirects; server-side authorization remains mandatory. See [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Verification

After installing dependencies and generating required Prisma/Next.js types, run `npm run check`, `npm run db:validate`, and `npm run test:seo`. Use isolated configuration and test credentials; these checks do not require production data.

The SEO test starts standalone servers on temporary loopback ports and stops them afterward. [`scripts/fixtures/seo-prisma.mjs`](../scripts/fixtures/seo-prisma.mjs) supplies in-memory data and rejects writes. The test covers HTML, metadata, XML, robots.txt, pagination, profile exclusions, internal links, private redirects, [structured data](aeo.md), and production/staging behavior using the same build. The fixture is loaded only by the test script.

## Production verification

1. Set the explicit production flag and confirm eligible public pages do not receive `noindex`; staging must remain blocked.
2. Verify domain ownership in Google Search Console and submit `https://universident.ro/sitemap.xml`. Check processing errors using the [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
3. Use [URL Inspection](https://support.google.com/webmasters/answer/9012289) on the homepage, directory, an available search, a later results page, and an eligible profile. Check live HTML, declared canonical, and crawler access.
4. Monitor indexing after recrawl. Private and empty pages should remain excluded; distinct searches and later pages should not all consolidate into `/studenti`. Sitemap submission does not guarantee indexing.
