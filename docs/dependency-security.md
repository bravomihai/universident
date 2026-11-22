# Dependency security

## Release policy

CI runs `npm audit --omit=dev` against the committed lockfile. Any reported vulnerability in that dependency scope fails the job and blocks deployment. A lower severity does not inherently prevent a build from running; the audit exit status enforces the release policy. Changing `--audit-level` changes that policy rather than fixing a vulnerability. See the [npm audit reference](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

Use `npm ci` for reproducible installs. Review production and full-tree audit findings when updating dependencies, apply compatible fixes, and rerun the relevant application, Prisma, and Docker checks. Do not suppress failed checks or apply forced major-version changes without compatibility review. Dependabot proposes npm updates weekly and Action updates monthly; updates require review and successful CI.

An npm audit is a database of known package advisories, not a complete application or container security assessment. Its production scope does not cover every package used by build or migration tooling.

## Dependency review: 21 October 2026

The production audit reported zero vulnerabilities after the following patches. This is a dated result; CI reevaluates the lockfile on each run.

| Dependency | Version change | Advisory scope |
| --- | --- | --- |
| Next.js | `16.3.6 → 16.3.8` | Cache/information disclosure issues and image-optimizer SSRF in affected configurations |
| sharp | `0.35.4 → 0.35.5` | librsvg memory-safety issue in native image processing |
| source-map-js | `1.2.1 → 1.2.2` | Denial of service from malformed indexed source maps |

`eslint-config-next` is aligned with Next.js. Compatible fixes for `proxy-addr`, MCP SDK, `undici`, `brace-expansion`, `hono`, `ip-address`, and `postcss-selector-parser` are recorded in the lockfile. Advisory presence does not establish exploitation: the Next.js SSRF advisory, for example, requires image remote-pattern configuration absent from this project.

References: [Next.js SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

## Dependency review: 30 October 2026

The production audit reports zero vulnerabilities after these compatible updates:

| Dependency | Locked version change |
| --- | --- |
| Next.js and eslint-config-next | `16.3.8 → 16.4.3` |
| Better Auth and its Prisma adapter | `1.6.29 → 1.7.14` |
| Zod 4 | `4.4.3 → 4.6.7` |
| fast-uri | `3.1.8 → 3.1.9` |

The redundant direct `@better-auth/prisma-adapter` dependency was removed. The application continues to use `better-auth/adapters/prisma`; Better Auth supplies the matching adapter version. The [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-keeps-the-provider-key) confirms that upgrades from 1.6 directly to 1.7.3 or later retain the existing account schema. This update does not require a database migration.

Compatible development-tooling fixes for `@hono/node-server`, `body-parser`, `qs`, and `systeminformation` are also recorded in the lockfile. The full audit still reports three affected packages (one low, two high), all in the shadcn CLI dependency tree: `deepmerge`, shadcn, and its nested Zod 3. The count includes the dependent CLI. No compatible automatic fix is available for this remaining tree; npm proposes a major downgrade of shadcn. Do not apply that downgrade or override Zod 3 with Zod 4 without a separate compatibility review. The full-tree result is not clean, and build/migrator images still include development tooling.

Validation covers schema validation, typecheck, lint, unit tests, isolated PostgreSQL auth/chat tests, standalone HTTP SEO checks, fixture/deployment regression tests, and the production Docker targets. The auth integration check exercises existing email/password accounts, both participant roles, cross-origin mutation rejection, and session revocation without sending email. The read-only SEO Prisma double explicitly permits the new adapter's optional metadata probe while continuing to reject unsupported operations.

References: [Next.js fixes](https://github.com/vercel/next.js/releases/tag/v16.4.1), [Better Auth fixes](https://github.com/better-auth/better-auth/releases/tag/v1.7.7), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [fast-uri](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [remaining deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

## Development-tooling review: 21 October 2026

At that review, the full audit reported eight high-severity affected packages, all tracing to [`braces@3.0.3`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Deeply nested brace patterns can exhaust the stack; no patched version was published as of the review date. The count includes dependent packages, not eight independently demonstrated application exploits.

The dependency is in the ESLint/shadcn toolchain, outside the npm production tree, and was absent from the inspected standalone server bundle. Build and migrator images do include development dependencies, so the tooling exposure remains relevant. Track the advisory and adopt a compatible fix when available. A forced downgrade of Next.js tooling or shadcn is not an accepted remediation. The production audit remains blocking; the full-tree result must not be described as clean.

## Prisma overrides

`package.json` contains scoped overrides for `@prisma/config@7.9.1 → deepmerge-ts@8.0.0` and `prisma → mysql2@3.24.4`. They address prior dependency advisories while retaining Prisma 7.9.1. Compatibility was checked through config loading, client generation, fresh migrations, and PostgreSQL integration tests. The Prisma configuration uses plain objects and does not depend on the changed Map behavior in deepmerge-ts 8.

Reevaluate these overrides when upgrading Prisma and remove them once the upstream dependency tree supplies suitable versions. See [deepmerge-ts 8.0.0](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
