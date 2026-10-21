# Public answers and structured data

Public answers and JSON-LD describe the same visible product information. They support machine-readable discovery without guaranteeing indexing or citation by AI services. See [Google's guidance for AI search features](https://developers.google.com/search/docs/appearance/ai-features).

## Content and schemas

The homepage answers five questions about the platform, supervised care, booking requests, adult eligibility, and student confirmation. Search pages explain the selected treatment/city and distinguish requests from confirmed appointments. Public profiles identify the provider as a dentistry student and show university and study year. Copy does not make unsupported clinical, pricing, or outcome claims.

| Page | JSON-LD |
| --- | --- |
| Homepage | `WebSite` and `WebPage`, matching visible identity and description |
| Directory | `CollectionPage` |
| Valid search with results | `ItemList` containing only the current page's students, with correct URL and list positions |
| Eligible public profile | `ProfilePage` with a `Person` entity |

Personalized results for signed-in users are excluded from JSON-LD. Profiles do not claim `Dentist` or `MedicalClinic` types, credentials, employers, prices, or unverified statistics. Visible questions use ordinary HTML; the implementation does not add `FAQPage` or `llms.txt`.

Shared copy lives in [`src/lib/seo/public-answers.ts`](../src/lib/seo/public-answers.ts), generators in [`src/lib/seo/structured-data.ts`](../src/lib/seo/structured-data.ts), and rendering in [`src/components/seo/structured-data.tsx`](../src/components/seo/structured-data.tsx).

## Visibility and privacy

Structured data requires the [public SEO environment](seo.md#environment). It is excluded from staging, demo/withdrawn/unverified/missing profiles, invalid or empty searches, authentication, and private pages. Existing crawler and authorization rules continue to apply.

Profile schema explicitly selects the public name, URL, university, and study year. It excludes emails, account identifiers, patient reviews, birth dates, notes, and appointments. Serialization escapes characters that could close the `<script>` element, including HTML in names.

## Verification

`npm run check` covers content/schema consistency, privacy, safe serialization, pagination, and the production build. After building, `npm run test:seo` inspects JSON-LD in actual HTTP responses using in-memory fixtures, including its absence on ineligible pages and in staging.

After deployment, follow [production SEO verification](seo.md#production-verification) and inspect representative public HTML and JSON-LD. Search engines determine indexing, presentation, and citations independently of the markup.
