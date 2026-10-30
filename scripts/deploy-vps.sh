#!/usr/bin/env bash
# Run on the VPS, directly or through ci-deploy-ssh.sh. Never applies migrations.
# Parse the complete function before executing commands: bash -s receives this
# file on stdin over SSH. Child processes must never consume that source stream.
main() {
  set -Eeuo pipefail

  stage=preflight
  on_error() {
    local exit_code=$?
    printf 'ERROR: VPS stage %s failed (exit %s). See docs/deployment.md.\n' "$stage" "$exit_code" >&2
    exit "$exit_code"
  }
  trap on_error ERR
  fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
  [[ $# == 3 ]] || fail 'Usage: bash scripts/deploy-vps.sh /absolute/checkout COMMIT_SHA verify|deploy'
  repo_path=$1
  sha=$2
  mode=$3
  [[ $repo_path == /* && $repo_path != / ]] || fail 'Expected an absolute checkout path'
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || fail 'Expected a full commit SHA'
  [[ $mode == verify || $mode == deploy ]] || fail 'Expected verify or deploy'
  for command in git docker flock timeout; do
    command -v "$command" > /dev/null || fail "Required command is missing: $command"
  done
  cd -- "$repo_path"
  [[ $(pwd -P) == "$(git rev-parse --show-toplevel)" ]] || fail 'VPS_PATH must be the repository root'

  if [[ $mode == deploy ]]; then
    # Covers manual invocations and remote processes surviving an SSH disconnect.
    exec 9> "$(git rev-parse --absolute-git-dir)/universident-deploy.lock"
    flock --exclusive --wait 60 9 || fail 'Another VPS deployment holds the lock'
  fi

  [[ $(git symbolic-ref --short HEAD) == main ]] || fail 'The VPS checkout must be on main'
  [[ -z $(git status --porcelain --untracked-files=normal) ]] || fail 'The VPS checkout has local changes; resolve them manually'
  [[ -s .env ]] || fail 'The existing server .env is missing or empty'
  if git ls-files --error-unmatch .env > /dev/null 2>&1; then
    fail 'The production .env must be untracked'
  fi
  docker compose version > /dev/null
  configure_compose() {
    local compose_file=compose-production.yaml
    # The runner streams the new script before the VPS checkout is updated.
    # Accept the previous filename only for preflight on that old checkout.
    if [[ ! -f $compose_file ]]; then
      if [[ ${1:-} == allow-legacy && -f compose.production.yaml ]]; then
        compose_file=compose.production.yaml
      else
        fail 'Missing compose-production.yaml'
      fi
    fi
    compose=(docker compose --project-directory "$PWD" --env-file "$PWD/.env" -f "$PWD/$compose_file")
    "${compose[@]}" config --quiet
  }
  configure_compose allow-legacy

  healthy() {
    local service=$1 container state
    container=$("${compose[@]}" ps --all --quiet "$service")
    [[ -n $container && $container != *$'\n'* ]] || fail "Expected exactly one existing $service container"
    state=$(docker inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")
    [[ $state == running/healthy ]] || fail "$service is not running and healthy; inspect it on the VPS"
  }
  # Refuse bootstrap/incorrect project paths instead of creating another database.
  healthy db
  healthy app
  healthy chat-email-worker

  if [[ $mode == verify ]]; then
    printf 'VPS preflight passed. No fetch, checkout, build, migration or service update was performed.\n'
    printf 'UNIVERSIDENT_VPS_COMPLETE %s %s\n' "$mode" "$sha"
    exit 0
  fi

  stage=fetch
  printf 'Fetching main and verifying tested commit %s.\n' "$sha"
  GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15' \
    git fetch --quiet --no-tags origin refs/heads/main
  [[ $(git rev-parse FETCH_HEAD) == "$sha" ]] || fail 'main has advanced since this run; deploy the latest successful main run'
  git merge-base --is-ancestor HEAD "$sha" || fail 'The VPS main branch cannot fast-forward to this commit'
  if git cat-file -e "$sha:.env" 2> /dev/null; then
    fail 'The target commit tracks .env; refusing to overwrite server configuration'
  fi
  previous_sha=$(git rev-parse HEAD)
  printf 'Previous checkout: %s\n' "$previous_sha"
  git merge --ff-only "$sha"
  # The new Compose definition must still address the existing healthy database.
  configure_compose
  healthy db

  stage=build
  printf 'Building existing app, migrator and worker targets.\n'
  "${compose[@]}" build app migrate chat-email-worker

  stage='migration-status'
  # Read-only Prisma command; suppress output containing server configuration.
  printf 'Checking production migration status; no migrations are applied.\n'
  if ! "${compose[@]}" run --rm --no-deps migrate npx --no-install prisma migrate status > /dev/null 2>&1; then
    fail 'Migration status is not clean (pending/failed/divergent migrations or database error). Running services were not updated. Review and apply migrations manually under the deployment lock, then rerun CI/CD.'
  fi

  stage='service-update'
  printf 'Updating app and worker; database and volumes stay in place.\n'
  "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 app chat-email-worker
  stage=health
  healthy db
  healthy app
  healthy chat-email-worker
  for service in app chat-email-worker; do
    container=$("${compose[@]}" ps --all --quiet "$service")
    image_ref=$(docker inspect --format '{{.Config.Image}}' "$container")
    expected_image=$(docker image inspect --format '{{.Id}}' "$image_ref")
    actual_image=$(docker inspect --format '{{.Image}}' "$container")
    [[ $actual_image == "$expected_image" ]] || fail "$service is healthy but is not running the built image"
  done
  printf 'Deployment healthy at commit %s. Previous checkout was %s.\n' "$sha" "$previous_sha"
  printf 'UNIVERSIDENT_VPS_COMPLETE %s %s\n' "$mode" "$sha"
}

main "$@" < /dev/null
