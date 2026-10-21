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

## Open development-tooling advisory

At that review, the full audit reported eight high-severity affected packages, all tracing to [`braces@3.0.3`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Deeply nested brace patterns can exhaust the stack; no patched version was published as of the review date. The count includes dependent packages, not eight independently demonstrated application exploits.

The dependency is in the ESLint/shadcn toolchain, outside the npm production tree, and was absent from the inspected standalone server bundle. Build and migrator images do include development dependencies, so the tooling exposure remains relevant. Track the advisory and adopt a compatible fix when available. A forced downgrade of Next.js tooling or shadcn is not an accepted remediation. The production audit remains blocking; the full-tree result must not be described as clean.

## Prisma overrides

`package.json` contains scoped overrides for `@prisma/config@7.9.1 → deepmerge-ts@8.0.0` and `prisma → mysql2@3.24.4`. They address prior dependency advisories while retaining Prisma 7.9.1. Compatibility was checked through config loading, client generation, fresh migrations, and PostgreSQL integration tests. The Prisma configuration uses plain objects and does not depend on the changed Map behavior in deepmerge-ts 8.

Reevaluate these overrides when upgrading Prisma and remove them once the upstream dependency tree supplies suitable versions. See [deepmerge-ts 8.0.0](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
