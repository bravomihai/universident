# CI/CD and VPS deployment

The workflow updates the existing VPS checkout, builds with `compose.production.yaml`, and replaces the application and chat email worker. Database storage, server configuration, and the reverse proxy remain on the VPS. Automatic deployment requires `VPS_DEPLOY_ENABLED=true`.

## Architecture and scope

The application uses Next.js standalone output, npm lockfiles, Node 24, and Prisma/PostgreSQL. The existing Dockerfile provides `runner` and `migrator` targets. Production Compose defines `db`, `app`, `chat-email-worker`, and the tools-profile `migrate` service, with a persistent PostgreSQL volume and loopback application port 3000.

CI tests fresh migrations in disposable databases. Production only checks migration status; operators apply reviewed migrations separately. The workflow updates an established installation and does not bootstrap infrastructure. See [dependency security](dependency-security.md) for audit policy and known tooling limitations.

## Triggers and checks

`.github/workflows/ci-cd.yml` runs on every pull request, pushes to `main`, and manual **Run workflow** requests. There are no path filters that could leave a required check missing.

The `CI` job uses an Ubuntu 24.04 runner, Node from `.nvmrc`, npm download caching keyed by `package-lock.json`, and PostgreSQL 18.4 matching Compose. It installs locked dependencies, validates Prisma, generates route types, checks types/lint, runs existing unit and fixture tests, applies/checks migrations on the disposable CI database, runs chat integration, builds Next.js, runs SEO integration, checks the deployment shells, builds both Docker targets, and audits production dependencies. Failures are not suppressed. CI has no production secrets and does not access the VPS. Its database credentials are intentionally disposable, public test values.

A fresh checkout needs generated Prisma and Next.js route types before typecheck; CI runs the existing postinstall generation and `next typegen`. Tests use Node's runner through tsx. The separately gated `src/lib/scheduling/phase2a.integration.ts` diagnostic is not included: it is outside `npm test` and combines fixed August/September 2026 dates with real-clock queries. Normal scheduling, recurrence, DST, overlap, and privacy unit tests remain enabled.

Deployment regression tests run with `node --test scripts/deploy-vps.test.mjs`. They use temporary Git repositories and simulated Docker/SSH commands to check streamed-script completion, failure gates, image verification, and verification mode without production access.

The workflow token has only `contents: read`; checkout does not persist credentials. Official checkout/setup-node actions use full commit pins. Dependabot checks Action updates monthly and npm updates weekly; review its PRs before merging. Updates are not merged automatically.

New runs cancel superseded **CI jobs**. Deployment jobs have a separate concurrency group with cancellation disabled, so new pushes do not cancel an active release. GitHub can replace an older pending deployment with a newer one; this is a latest-release queue, not a guarantee to deploy every commit. [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Required GitHub configuration

In repository **Settings → Environments**, create an environment named **`production`**. Restrict its deployment branches to **`main`**. Required reviewers are optional: adding them makes each deployment require approval, while omitting them permits automatic deployment after CI.

Under that environment's **Secrets**, add every entry below. Do not put secrets in workflow YAML, files committed to Git, or CI build arguments.

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP reachable from GitHub-hosted runners; no `ssh://`, username, or port. |
| `VPS_PORT` | SSH port, including `22` if standard. |
| `VPS_USER` | Existing deployment account that can update the checkout, read `.env`, and run Docker without interactive sudo. |
| `VPS_PATH` | Absolute path to the **existing repository root** on the VPS, without spaces. |
| `VPS_SSH_PRIVATE_KEY` | Entire dedicated, unencrypted Ed25519 private key, including header/footer and newlines. Its public key must be authorized for `VPS_USER`. |
| `VPS_SSH_KNOWN_HOSTS` | Independently verified OpenSSH known_hosts entry for exactly `VPS_HOST` and `VPS_PORT`. See below. |
| `VPS_HEALTH_URL` | Exact public HTTPS `/api/health` URL, for example `https://universident.ro/api/health`. No credentials, query string, or redirect. Must return HTTP 200. |

In **Settings → Secrets and variables → Actions → Variables**, add the **repository variable** `VPS_DEPLOY_ENABLED`, initially **`false`**. Only the exact string **`true`** enables CD on pushes to main. With branch protection, merge a successful PR into `main`; a push to a feature branch does not deploy. This must be a repository variable because the job condition is evaluated before environment variables become available. Do not enable it until the safe verification steps pass.

In the repository's Actions settings, allow the pinned official actions. Require pull requests and the `CI` check for `main`; review workflow and deployment-script changes because merged code can access deployment credentials. No SSH credentials or production environment are attached to pull-request jobs. [GitHub environment secrets and protection rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## SSH setup and host verification

Use a dedicated Linux account such as `universident-deploy`, with SSH key authentication and no general-purpose sudo access. Set `VPS_USER` to that account. It must be able to traverse the checkout's parent directories, update the checkout and `.git`, read the existing `.env`, and run Docker Compose noninteractively. Review existing ownership before changing permissions; do not alter PostgreSQL volume ownership or create a second Compose installation.

With a rootful Docker daemon, membership in the `docker` group grants root-equivalent control. A dedicated account separates credentials and audit trails but is not a privilege boundary around that daemon. See [Docker's access guidance](https://docs.docker.com/engine/install/linux-postinstall/).

There are two independent connections:

| Connection | Private key | Public key |
| --- | --- | --- |
| GitHub Actions → VPS | `production` environment secret `VPS_SSH_PRIVATE_KEY` | Deployment account's `~/.ssh/authorized_keys` on the VPS |
| VPS → GitHub, when using SSH | Deployment account's SSH directory on the VPS | Repository **Settings → Deploy keys**, read-only |

Use distinct keys for the two connections. The first key belongs in Actions Secrets, not personal GitHub SSH keys or repository Deploy keys. Public repositories can instead be fetched over HTTPS without credentials; no second key is then required. For private repositories, use existing read-only repository access or a dedicated read-only deploy key. See [GitHub's deploy-key documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

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

Use the existing Linux checkout on branch `main`, with a clean working tree and an `origin` pointing to this repository. Local tracked edits and untracked files must be resolved manually; the script never resets, cleans, stashes, or force-updates the checkout. Ignored `.env` remains in place. Confirm the server uses **this repository's `compose.production.yaml` without additional overrides** before activation. Installations with overrides, a different environment file, project name, or directory require a reviewed script adaptation before activation.

The noninteractive SSH session needs Bash, Git, GNU timeout, flock (util-linux), Docker Engine, and Docker Compose v2.24 or newer on PATH. Allow sufficient disk and memory for the existing Node 24 Docker builds and HTTPS outbound access for npm/fonts/image pulls. The existing database, app, and email worker must all be running and healthy. This pipeline updates an established installation; it refuses to bootstrap a missing database or fix an unhealthy installation automatically.

Keep production application configuration **only in the VPS's existing, untracked `.env`**. Compose requires `POSTGRES_PASSWORD`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, and `CHAT_WORKER_SECRET`; retain existing database names/users and optional model settings. Compose constructs the internal `DATABASE_URL`. `BETTER_AUTH_URL` must be the final HTTPS origin, and `DEPLOYMENT_ENV=production` explicitly enables public indexing. Do not copy production values to GitHub CI. Protect the file with restrictive permissions readable by the deployment account.

The existing Compose project identity, PostgreSQL volume, database credentials, loopback binding, and external HTTPS proxy must remain the same. Verify automated backups and a tested restore process separately.

## What a deployment does

After successful CI on main, a push deploys only when `VPS_DEPLOY_ENABLED=true`. A manual run on main offers `verify` (default) or `deploy`; manual `deploy` is an explicit deployment request and works even while automatic deployment is disabled. Non-main manual runs perform CI only.

The runner sends `scripts/deploy-vps.sh` over authenticated SSH; the script receives the configured checkout path, the exact tested commit SHA, and mode. Bash parses the complete deployment function before running it with stdin redirected to `/dev/null`, so child commands cannot consume the script source. The runner requires an explicit completion marker for that mode and SHA before checking public health. It does not install a persistent server script or copy `.env`.

1. Validate the existing checkout, untracked `.env`, Compose configuration, and healthy database/app/worker.
2. In `verify` mode, stop here. The runner also checks public HTTPS health. No fetch, checkout update, build, migration command, or service update runs. This checks connectivity/prerequisites, not the VPS's ability to fetch/build the next release.
3. In `deploy` mode, hold `.git/universident-deploy.lock` with flock for the entire operation. Manual releases/migrations must use the same lock. Fetch main with strict SSH host checking and require its tip to equal this run's tested SHA. Refuse stale or non-fast-forward deployments.
4. Refuse any target commit that tracks `.env`, then fast-forward the existing `main` checkout, recording the previous SHA in the Actions log. Build `app`, `migrate`, and `chat-email-worker` using the existing Dockerfile/Compose configuration.
5. Run **only** `npx --no-install prisma migrate status` in a disposable migrator container, using `--no-deps`. Pending, failed, or divergent migrations and connection errors stop the release before service replacement. Output that could reveal database configuration is suppressed; inspect status directly on the VPS if it fails.
6. Run `docker compose ... up -d --no-deps --no-build --pull never --wait --wait-timeout 180 app chat-email-worker`. The database is never targeted for recreation. Confirm container health and that the app/worker image IDs match their built images, then require HTTP 200 from public HTTPS `/api/health`.

There is no `down`, volume deletion, database reset, automatic seed, migration application, image/volume pruning, or automatic rollback. `run --rm migrate` removes only its disposable status-check container. CI's migration application is isolated to the GitHub runner. Health endpoints alone do not validate email delivery; retain an authorized email smoke test as a release gate for email changes.

CI has a 35-minute timeout. Deployment has a 40-minute job limit, a 35-minute remote timeout, a 37-minute SSH client timeout, bounded lock/connection/health waits, and an explicit failure annotation. Remote timeout and flock help protect against overlapping work after a lost connection. Do not assume canceling the Actions UI immediately stops a remote Docker build; inspect the server/lock before manual intervention.

This retains the current single-VPS Compose service replacement and its possible brief interruption; it does not introduce zero-downtime traffic switching. On build/status failure, running services remain as they were but the checkout/new image tags may have advanced. On service-update or health failure, services may already be replaced or partially updated. Logs report the stage; investigate on the VPS rather than rerunning blindly.

## Safe activation and verification

1. Keep `VPS_DEPLOY_ENABLED` absent or `false` while validating the workflow. Pushes then run CI without connecting to the VPS. Confirm the pull-request and main `CI` checks, including Docker builds, are green. Existing failing checks must be fixed, never bypassed.
2. Verify the existing server path, branch, Compose command/project/volume, healthy containers, backup, and `.env`. Configure the `production` environment, main-only restriction, seven secrets, dedicated key, and verified host key as above. Verify server-to-GitHub fetch access separately.
3. In **Actions → CI / CD → Run workflow**, select branch **main**, mode **verify**. It reruns CI, then checks SSH, checkout/configuration, current container health, and public HTTPS health without changing the running deployment. Inspect the step summary and verify nothing restarted. All CI gates must pass before this SSH check runs.
4. For the first approved release, manually run **deploy** on **main** with the automatic flag still false. This is the first live update; confirm the tested SHA, app/worker health, public pages/login, and authorized email delivery.
5. Once satisfied, change the **repository** variable `VPS_DEPLOY_ENABLED` to **`true`**. The next successful push/merge to main deploys automatically; setting it does not retroactively deploy a previous commit. A documentation-only main push can verify the complete automatic path. Check the deployed `git rev-parse HEAD` against the successful Actions SHA and inspect health. A pull-request run must never show a deployment job accessing the environment.
6. To disable new automatic deployments, set the variable back to `false`. This does not stop an already running release, and does not disable explicit manual `deploy` requests.

To test against a separate VPS/staging installation first, use a separately cloned repository with these settings targeting that installation and its existing Compose project. Do not run a second project against the production volume.

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
