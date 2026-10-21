# GitHub Actions CI/CD and existing VPS deployment

The pipeline automates the existing process: update the VPS checkout, build locally on the VPS with `compose.production.yaml`, and update the app and chat email worker. It does not introduce a registry, hosting provider, new database, reverse proxy, or deployment service. Nothing is deployed merely by adding these files: automatic CD requires the repository variable described below.

## Repository inspection and design

- Next.js App Router / React / TypeScript; standalone output in `next.config.ts`. Global security headers are unchanged.
- npm with a committed lockfile, Node 24 in `.nvmrc` and the Dockerfile. `npm ci` runs the existing `postinstall` Prisma generation. A fresh checkout needs `next typegen` before typecheck; generated route types and `next-env.d.ts` are not committed.
- `npm run check` comprises typecheck, ESLint, `npm test`, and the webpack production build. Tests use Node's test runner through tsx, rather than Vitest. CI runs the constituent checks separately for clear failures.
- Additional existing checks: `db:validate`, local demo fixture safety tests, the isolated PostgreSQL chat integration script, and `test:seo` against the standalone build. No real email or OpenAI credentials are supplied; chat integration injects test providers and uses the React Server export condition for its `server-only` imports. SEO uses the existing in-memory Prisma fixture.
- `src/lib/scheduling/phase2a.integration.ts` is a separately gated destructive database diagnostic outside `npm test`. It requires a specially named database and includes fixed August/September 2026 dates alongside real-clock queries. It is not enabled by this workflow. The normal scheduling, overlap, recurrence, DST, and privacy unit tests run without skipping them.
- Prisma migrations and catalogs are in `prisma/`. CI applies migrations only to disposable runner databases. Production only runs `prisma migrate status`; it never seeds or applies migrations.
- The existing multi-stage Dockerfile has `runner` and `migrator` targets. CI builds both, without production configuration. `.dockerignore` already excludes `.env` and other local secrets.
- Production Compose defines `db`, `app`, `chat-email-worker`, and a tools-profile `migrate` service. PostgreSQL uses its existing named volume; the app binds to loopback port 3000. App and worker health checks already exist.
- There were no checked-in deployment scripts or Actions workflows. The manual sequence in `docs/release-check-2026-09-13.md` builds these services, runs migrations, then updates services. The user confirmed deployment currently consists of pulling and building with Docker Compose. Automation retains that infrastructure and leaves migration execution manual.

## Triggers and checks

`.github/workflows/ci-cd.yml` runs on every pull request, pushes to `main`, and manual **Run workflow** requests. There are no path filters that could leave a required check missing.

The `CI` job uses an Ubuntu 24.04 runner, Node from `.nvmrc`, npm download caching keyed by `package-lock.json`, and PostgreSQL 18.4 matching Compose. It installs locked dependencies, validates Prisma, generates route types, checks types/lint, runs existing unit and fixture tests, applies/checks migrations on the disposable CI database, runs chat integration, builds Next.js, runs SEO integration, checks the deployment shells, builds both Docker targets, and audits production dependencies. Failures are not suppressed. CI has no production secrets and does not access the VPS. Its database credentials are intentionally disposable, public test values.

The workflow token has only `contents: read`; checkout does not persist credentials. Official checkout/setup-node actions use full commit pins. Dependabot checks Action updates monthly and npm updates weekly; review its PRs before merging. Updates are not merged automatically.

New runs cancel superseded **CI jobs**. Deployment jobs have a separate concurrency group with cancellation disabled, so new pushes do not cancel an active release. GitHub can replace an older pending deployment with a newer one; this is a latest-release queue, not a guarantee to deploy every commit. [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Required GitHub configuration

In repository **Settings → Environments**, create an environment named **`production`**. Restrict its deployment branches to **`main`**. Required reviewers are optional: adding them makes each deployment require approval, while omitting them permits automatic deployment after CI.

Under that environment's **Secrets**, add every entry below. Do not put secrets in workflow YAML, files committed to Git, or CI build arguments.

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP reachable from GitHub-hosted runners; no `ssh://`, username, or port. |
| `VPS_PORT` | SSH port, including `22` if standard. |
| `VPS_USER` | Existing deployment account that owns the checkout and can run Docker without interactive sudo. |
| `VPS_PATH` | Absolute path to the **existing repository root** on the VPS. No spaces. This is configuration, not a request to create a new checkout. |
| `VPS_SSH_PRIVATE_KEY` | Entire dedicated, unencrypted Ed25519 private key, including header/footer and newlines. Its public key must be authorized for `VPS_USER`. |
| `VPS_SSH_KNOWN_HOSTS` | Independently verified OpenSSH known_hosts entry for exactly `VPS_HOST` and `VPS_PORT`. See below. |
| `VPS_HEALTH_URL` | Exact public HTTPS `/api/health` URL, for example `https://universident.ro/api/health`. No credentials, query string, or redirect. Must return HTTP 200. |

In **Settings → Secrets and variables → Actions → Variables**, add the **repository variable** `VPS_DEPLOY_ENABLED`, initially **`false`**. Only the exact string **`true`** enables CD on pushes to main. This must be a repository variable because the job condition is evaluated before environment variables become available. Do not enable it until the safe verification steps pass.

In the repository's Actions settings, allow the pinned official actions. Make the `CI` job a required check in the `main` branch ruleset. Protect `main` and review changes to workflows/deployment scripts: merged code is trusted to access deployment credentials. No SSH credentials or production environment are attached to pull-request jobs. [GitHub environment secrets and protection rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## SSH setup and host verification

Generate a dedicated key **outside the repository** on a trusted workstation:

```bash
ssh-keygen -t ed25519 -C github-actions-universident -f ~/.ssh/universident-actions -N ''
```

Add only the `.pub` contents to the deployment account's `~/.ssh/authorized_keys`. Prefix that entry with `restrict` to disable forwarding, PTY, and related capabilities while permitting the remote deployment command. Keep the account's SSH directory/file permissions at 700/600. Store the private key only in `VPS_SSH_PRIVATE_KEY` and a secure local location. Docker access grants substantial control over the host; use a dedicated account and key rather than root's key.

Obtain the server's Ed25519 fingerprint through a trusted VPS console or an already verified SSH connection:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the workstation, collect the matching entry and compare its fingerprint with that trusted value:

```bash
ssh-keyscan -p YOUR_SSH_PORT -t ed25519 YOUR_VPS_HOST > universident-known-hosts
ssh-keygen -lf universident-known-hosts
```

Only after the fingerprints match, store the entry as `VPS_SSH_KNOWN_HOSTS`. A nonstandard port needs the `[hostname]:port` known_hosts form, which keyscan emits. Use the same hostname/IP as `VPS_HOST`. Keyscan alone is not authentication. The workflow never discovers or blindly accepts a host key, and uses `StrictHostKeyChecking=yes`, a dedicated known_hosts file, no agent forwarding, and batch authentication. Rotate the secret only after independently verifying a replacement key.

The VPS also needs its **own existing read access to this GitHub repository** for `git fetch origin main`. The Actions-to-VPS key does not provide VPS-to-GitHub access. For a private repository, retain or configure a read-only GitHub deploy key and independently verified GitHub host key on the VPS. Do not embed a token in the origin URL. Verify noninteractive fetching manually before activation.

## VPS prerequisites and retained configuration

Use the existing Linux checkout on branch `main`, with a clean working tree and an `origin` pointing to this repository. Local tracked edits and untracked files must be resolved manually; the script never resets, cleans, stashes, or force-updates the checkout. Ignored `.env` remains in place. Confirm the server uses **this repository's `compose.production.yaml` without additional overrides** before activation. If your real command uses overrides, a different env file, project name, or directory, adapt and review the script first; do not point the pipeline at an unverified path.

The noninteractive SSH session needs Bash, Git, GNU timeout, flock (util-linux), Docker Engine, and Docker Compose v2.24 or newer on PATH. Allow sufficient disk and memory for the existing Node 24 Docker builds and HTTPS outbound access for npm/fonts/image pulls. The existing database, app, and email worker must all be running and healthy. This pipeline updates an established installation; it refuses to bootstrap a missing database or fix an unhealthy installation automatically.

Keep production application configuration **only in the VPS's existing, untracked `.env`**. Compose requires `POSTGRES_PASSWORD`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, and `CHAT_WORKER_SECRET`; retain existing database names/users and optional model settings. Compose constructs the internal `DATABASE_URL`. `BETTER_AUTH_URL` must be the final HTTPS origin, and `DEPLOYMENT_ENV=production` explicitly enables public indexing. Do not copy production values to GitHub CI. Protect the file with restrictive permissions readable by the deployment account.

The existing Compose project identity, PostgreSQL volume, database credentials, loopback binding, and external HTTPS proxy must remain the same. Verify automated backups and a tested restore process separately.

## What a deployment does

After successful CI on main, a push deploys only when `VPS_DEPLOY_ENABLED=true`. A manual run on main offers `verify` (default) or `deploy`; manual `deploy` is an explicit deployment request and works even while automatic deployment is disabled. Non-main manual runs perform CI only.

The runner sends `scripts/deploy-vps.sh` over authenticated SSH; the script receives the configured checkout path, the exact tested commit SHA, and mode. It does not install a persistent server script or copy `.env`.

1. Validate the existing checkout, untracked `.env`, Compose configuration, and healthy database/app/worker.
2. In `verify` mode, stop here. The runner also checks public HTTPS health. No fetch, checkout update, build, migration command, or service update runs. This checks connectivity/prerequisites, not the VPS's ability to fetch/build the next release.
3. In `deploy` mode, hold `.git/universident-deploy.lock` with flock for the entire operation. Manual releases/migrations must use the same lock. Fetch main with strict SSH host checking and require its tip to equal this run's tested SHA. Refuse stale or non-fast-forward deployments.
4. Refuse any target commit that tracks `.env`, then fast-forward the existing `main` checkout, recording the previous SHA in the Actions log. Build `app`, `migrate`, and `chat-email-worker` using the existing Dockerfile/Compose configuration.
5. Run **only** `npx --no-install prisma migrate status` in a disposable migrator container, using `--no-deps`. Pending, failed, or divergent migrations and connection errors stop the release before service replacement. Output that could reveal database configuration is suppressed; inspect status directly on the VPS if it fails.
6. Run `docker compose ... up -d --no-deps --no-build --pull never --wait --wait-timeout 180 app chat-email-worker`. The database is never targeted for recreation. Confirm container health, then require HTTP 200 from public HTTPS `/api/health`.

There is no `down`, volume deletion, database reset, automatic seed, migration application, image/volume pruning, or automatic rollback. `run --rm migrate` removes only its disposable status-check container. CI's migration application is isolated to the GitHub runner. Health endpoints alone do not validate email delivery; retain an authorized email smoke test as a release gate for email changes.

CI has a 35-minute timeout. Deployment has a 40-minute job limit, a 35-minute remote timeout, a 37-minute SSH client timeout, bounded lock/connection/health waits, and an explicit failure annotation. Remote timeout and flock help protect against overlapping work after a lost connection. Do not assume canceling the Actions UI immediately stops a remote Docker build; inspect the server/lock before manual intervention.

This retains the current single-VPS Compose service replacement and its possible brief interruption; it does not introduce zero-downtime traffic switching. On build/status failure, running services remain as they were but the checkout/new image tags may have advanced. On service-update or health failure, services may already be replaced or partially updated. Logs report the stage; investigate on the VPS rather than rerunning blindly.

## Safe activation and verification

1. Review and merge these files with `VPS_DEPLOY_ENABLED` absent or `false`. No live server connection or update is triggered by that push. Confirm the pull-request and main `CI` checks, including Docker builds, are green. Existing failing checks must be fixed, never bypassed.
2. Verify the existing server path, branch, Compose command/project/volume, healthy containers, backup, and `.env`. Configure the `production` environment, main-only restriction, seven secrets, dedicated key, and verified host key as above. Verify server-to-GitHub fetch access separately.
3. In **Actions → CI / CD → Run workflow**, select branch **main**, mode **verify**. It reruns CI, then checks SSH, checkout/configuration, current container health, and public HTTPS health without changing the running deployment. Inspect the step summary and verify nothing restarted. All CI gates must pass before this SSH check runs.
4. After that passes and you intend a real release, manually run mode **deploy** on **main**, leaving the automatic flag false. This is the first live update; confirm the tested SHA, app/worker health, public pages/login, and authorized email delivery. This implementation work does not perform that action for you.
5. Once satisfied, change the **repository** variable `VPS_DEPLOY_ENABLED` to **`true`**. The next successful push/merge to main deploys automatically; setting it does not retroactively deploy a previous commit. A documentation-only main push can verify the complete automatic path. Check the deployed `git rev-parse HEAD` against the successful Actions SHA and inspect health. A pull-request run must never show a deployment job accessing the environment.
6. To disable new automatic deployments, set the variable back to `false`. This does not stop an already running release, and does not disable explicit manual `deploy` requests.

To test against a separate VPS/staging installation first, use a separately cloned repository with these settings targeting that installation and its existing Compose project. Do not run a second project against the production volume. No staging service is required by this implementation.

## Manual migrations, failure recovery, and rollback

If status blocks a deployment, inspect pending SQL, verify the database identity and backup, and review compatibility with the currently running app. Stop automatic releases while preparing changes. Apply approved migrations manually in the same checkout under the shared lock, **before** the next service update. For example, after reviewing the exact checked-out commit:

```bash
cd /absolute/existing/checkout
lock_path="$(git rev-parse --absolute-git-dir)/universident-deploy.lock"
(
  flock --exclusive --wait 60 9 || exit 1
  docker compose -f compose.production.yaml build migrate &&
    docker compose -f compose.production.yaml run --rm --no-deps migrate &&
    docker compose -f compose.production.yaml run --rm --no-deps migrate npx --no-install prisma migrate status
) 9> "$lock_path"
```

These are operator commands, never executed by Actions. Use the same environment/project options as your installation. Do not apply a migration that breaks the old running application without a reviewed maintenance plan. Rerun the successful main workflow with `deploy` after manual migration; status must now be clean. Never use `db push`, reset, or restore over production as an automatic recovery step.

For a failed build/status check, inspect the named stage and correct the underlying issue. For failed health, use `docker compose -f compose.production.yaml ps` and inspect restricted server-side logs/status (which may contain private information); the workflow intentionally does not upload application/database logs. Fix infrastructure/configuration or deploy a reviewed correction. For rollback, assess schema compatibility, revert the bad application change through a reviewed main commit, and run CI/CD. Never automatically roll back the database. Preserve backups and previous images until the release is accepted; disk cleanup remains a separate deliberate maintenance task.

## Implementation validation (21 October 2026)

Validation used an isolated temporary checkout without the local `.env`, with Node 24.19.0 and locked dependencies:

| Check | Result |
| --- | --- |
| Clean `npm ci`, Prisma generation/schema validation, route type generation | Passed |
| TypeScript and ESLint | Passed |
| `npm test` and existing fixture safety tests | 193 + 20 passed, none skipped |
| Next.js production build | Passed |
| Standalone SEO/AEO HTTP checks | 38 requests passed |
| All 26 migrations and migration status | Passed against a fresh, temporary PostgreSQL 18.6 cluster on loopback port 55439; cluster stopped afterward |
| PostgreSQL chat integration | Passed; its generated test database was removed by the existing test script |
| Workflow syntax, Bash syntax, ShellCheck | Passed with actionlint 1.7.12 and ShellCheck 0.11.0 |
| Deployment control flow | Seven local scenarios passed: verify, successful update, dirty checkout, stale commit, target tracking `.env`, pending migration, and failed build. Used temporary real Git repositories and a recording Docker stub, not a live VPS/container deployment. |
| `npm audit --omit=dev` | Passed after targeted dependency updates: **0 vulnerabilities** |
| Full `npm audit` | 8 high findings remain in development tools, all tracing to the same unpatched `braces` advisory. See [the security explanation](ci-cd-explicat.md). No critical findings remain. |
| Docker builds | Not run locally: Docker Desktop's Linux daemon was unavailable. Both are mandatory checks in Actions. |
| SSH / real VPS deployment | Not attempted; requires configured secrets and explicit activation |

The existing SEO test assumed question text was a direct child of `<dt>`, whereas the current UI contains decorative icons and a span. Its assertions now extract question text within each `<dt>` and still require the same exact questions. No assertion was removed and application behavior was unchanged.

The production audit remains a blocking CI/release gate with its original severity threshold. Next.js was patched to 16.3.8, its ESLint configuration aligned to that version, and vulnerable transitive packages with available compatible fixes were updated in the lockfile. The full local application checks and SEO checks were repeated on the updated dependency tree. The remaining development advisory is explicitly documented; no audit threshold was relaxed and no failing production check was bypassed.
