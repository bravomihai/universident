import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = readFileSync(new URL("./deploy-vps.sh", import.meta.url), "utf8");

function fixture(t, { renameCompose = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "universident-deploy-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, "origin.git");
  const source = join(root, "source");
  const repo = join(root, "checkout");
  const bin = join(root, "bin");
  const log = join(root, "docker.log");
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Deployment test",
    GIT_AUTHOR_EMAIL: "deployment@example.invalid",
    GIT_COMMITTER_NAME: "Deployment test",
    GIT_COMMITTER_EMAIL: "deployment@example.invalid",
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_DOCKER_LOG: log,
    FAKE_DOCKER_STATE: join(root, "updated"),
  };
  function git(...args) {
    const result = spawnSync("git", args, { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--bare", "--initial-branch=main", origin);
  git("clone", origin, source);
  writeFileSync(join(source, ".gitignore"), ".env\n");
  const initialComposeFile = renameCompose ? "compose.production.yaml" : "compose-production.yaml";
  writeFileSync(join(source, initialComposeFile), "name: universident\n");
  git("-C", source, "add", ".");
  git("-C", source, "commit", "-m", "Existing deployment");
  git("-C", source, "push", "origin", "main");
  git("clone", origin, repo);
  const previous = git("-C", repo, "rev-parse", "HEAD");
  if (renameCompose) git("-C", source, "mv", "compose.production.yaml", "compose-production.yaml");
  writeFileSync(join(source, "release.txt"), "new application version\n");
  git("-C", source, "add", "release.txt");
  git("-C", source, "commit", "-m", "Next release");
  git("-C", source, "push", "origin", "main");
  const target = git("-C", source, "rev-parse", "HEAD");
  writeFileSync(join(repo, ".env"), "TEST_CONFIGURATION=preserve-me\n");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
if [[ $1 == compose ]]; then
  shift
  compose_file=
  while [[ \${1:-} == --project-directory || \${1:-} == --env-file || \${1:-} == -f ]]; do
    if [[ $1 == -f ]]; then compose_file=$2; fi
    shift 2
  done
  if [[ $1 != version && ( -z $compose_file || ! -f $compose_file ) ]]; then
    printf 'Missing Compose file: %s\\n' "$compose_file" >&2
    exit 98
  fi
  case $1 in
    version|config) exit 0 ;;
    ps) printf '%s\\n' "\${@: -1}"; exit 0 ;;
    build)
      # Reproduce a child process consuming the script streamed through bash -s.
      cat > /dev/null
      exit "\${FAKE_BUILD_EXIT:-0}" ;;
    run)
      cat > /dev/null
      exit "\${FAKE_MIGRATION_EXIT:-0}" ;;
    up)
      [[ \${FAKE_NO_RECREATE:-0} == 1 ]] || touch "$FAKE_DOCKER_STATE"
      exit 0 ;;
  esac
elif [[ $1 == inspect ]]; then
  case $3 in
    *State.Status*) printf 'running/healthy\\n'; exit 0 ;;
    *Config.Image*) printf 'universident-%s\\n' "\${@: -1}"; exit 0 ;;
    '{{.Image}}')
      if [[ -e $FAKE_DOCKER_STATE ]]; then printf 'sha256:new\\n'; else printf 'sha256:old\\n'; fi
      exit 0 ;;
  esac
elif [[ $1 == image && $2 == inspect ]]; then
  printf 'sha256:new\\n'; exit 0
fi
printf 'Unexpected fake Docker command: %s\\n' "$*" >&2
exit 99
`, { mode: 0o755 });
  return {
    target, previous,
    run(mode = "deploy", overrides = {}) {
      return spawnSync("bash", ["-s", "--", repo, target, mode], {
        input: script, encoding: "utf8", env: { ...env, ...overrides }, timeout: 15_000,
      });
    },
    head: () => git("-C", repo, "rev-parse", "HEAD"),
    commands: () => readFileSync(log, "utf8"),
    configuration: () => readFileSync(join(repo, ".env"), "utf8"),
  };
}

test("streamed deployment reaches migration status and service update when Docker reads stdin", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.commands(), /prisma migrate status/);
  assert.match(f.commands(), /up -d .* app chat-email-worker/);
  assert.equal(f.head(), f.target);
  assert.equal(f.configuration(), "TEST_CONFIGURATION=preserve-me\n");
  assert.match(result.stdout, /Deployment healthy at commit/);
  assert.ok(result.stdout.includes(`UNIVERSIDENT_VPS_COMPLETE deploy ${f.target}`));
});

test("pending migrations stop deployment before updating services", (t) => {
  const f = fixture(t);
  const result = f.run("deploy", { FAKE_MIGRATION_EXIT: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Migration status is not clean/);
  assert.doesNotMatch(f.commands(), /up -d/);
  assert.doesNotMatch(result.stdout, /UNIVERSIDENT_VPS_COMPLETE/);
});

test("healthy containers using old images cannot report a successful deployment", (t) => {
  const f = fixture(t);
  const result = f.run("deploy", { FAKE_NO_RECREATE: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not running the built image/);
  assert.doesNotMatch(result.stdout, /UNIVERSIDENT_VPS_COMPLETE/);
});

test("build failure stops deployment before migration checks or service updates", (t) => {
  const f = fixture(t);
  const result = f.run("deploy", { FAKE_BUILD_EXIT: "1" });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(f.commands(), /prisma migrate status|up -d/);
  assert.doesNotMatch(result.stdout, /UNIVERSIDENT_VPS_COMPLETE/);
});

test("verify leaves checkout and services unchanged", (t) => {
  const f = fixture(t);
  const result = f.run("verify");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.head(), f.previous);
  assert.doesNotMatch(f.commands(), /build|prisma migrate status|up -d/);
  assert.ok(result.stdout.includes(`UNIVERSIDENT_VPS_COMPLETE verify ${f.target}`));
});

test("the first deployment preflights the old Compose filename and uses the renamed file after updating", (t) => {
  const f = fixture(t, { renameCompose: true });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const commands = f.commands().trim().split("\n");
  const legacy = commands.filter((command) => command.includes("/compose.production.yaml "));
  const renamed = commands.filter((command) => command.includes("/compose-production.yaml "));
  assert.ok(legacy.some((command) => command.endsWith("config --quiet")));
  assert.ok(legacy.some((command) => command.endsWith("ps --all --quiet db")));
  assert.ok(legacy.every((command) => !/ build | run | up /.test(command)));
  assert.ok(renamed.some((command) => command.includes("build app migrate chat-email-worker")));
  assert.ok(renamed.some((command) => command.includes("prisma migrate status")));
  assert.ok(renamed.some((command) => command.includes("up -d ")));
  const firstRenamed = commands.findIndex((command) => command.includes("/compose-production.yaml "));
  assert.ok(commands.slice(firstRenamed).every((command) => !command.includes("/compose.production.yaml ")));
  assert.equal(f.head(), f.target);
  assert.equal(f.configuration(), "TEST_CONFIGURATION=preserve-me\n");
  assert.match(result.stdout, /Deployment healthy at commit/);
});

test("verify accepts the old Compose filename without updating the checkout or services", (t) => {
  const f = fixture(t, { renameCompose: true });
  const result = f.run("verify");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.head(), f.previous);
  assert.match(f.commands(), /\/compose\.production\.yaml config --quiet/);
  assert.doesNotMatch(f.commands(), /compose-production\.yaml|build|prisma migrate status|up -d/);
  assert.ok(result.stdout.includes(`UNIVERSIDENT_VPS_COMPLETE verify ${f.target}`));
});

function runClient(t, remoteOutput) {
  const root = mkdtempSync(join(tmpdir(), "universident-ssh-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [command, body] of Object.entries({
    "ssh-keygen": "exit 0",
    ssh: 'cat > /dev/null\nprintf "%s\\n" "$FAKE_REMOTE_OUTPUT"',
    curl: 'touch "$FAKE_HEALTH_CALLED"\nprintf 200',
  })) {
    writeFileSync(join(root, command), `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o755 });
  }
  const result = spawnSync("bash", ["scripts/ci-deploy-ssh.sh"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 15_000,
    env: {
      ...process.env, PATH: `${root}:${process.env.PATH}`,
      VPS_HOST: "example.invalid", VPS_PORT: "22", VPS_USER: "deploy",
      VPS_PATH: "/tmp/test-checkout", VPS_SSH_PRIVATE_KEY: "unused-test-key",
      VPS_SSH_KNOWN_HOSTS: "unused-test-host-key", VPS_HEALTH_URL: "https://example.invalid/api/health",
      DEPLOY_SHA: "a".repeat(40), DEPLOY_MODE: "deploy", GITHUB_STEP_SUMMARY: "",
      FAKE_REMOTE_OUTPUT: remoteOutput, FAKE_HEALTH_CALLED: join(root, "health-called"),
    },
  });
  return { result, healthCalled: () => existsSync(join(root, "health-called")) };
}

test("SSH success without remote completion cannot pass via the old application's health endpoint", (t) => {
  const { result, healthCalled } = runClient(t, "Images built; remote script ended early");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Remote script did not confirm completion/);
  assert.equal(healthCalled(), false);
});

test("confirmed remote completion proceeds to public health verification", (t) => {
  const { result, healthCalled } = runClient(t, `UNIVERSIDENT_VPS_COMPLETE deploy ${"a".repeat(40)}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(healthCalled(), true);
});
