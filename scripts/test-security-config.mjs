import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Explicit local integration check. It creates its own disposable PostgreSQL
// container/database and never reads .env or uses a configured application DB.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const { Client } = require("pg");
const label = `universident-security-${randomBytes(8).toString("hex")}`;
const password = randomBytes(24).toString("hex");
const baseEnv = {
  ...process.env,
  NODE_ENV: "development",
  POSTGRES_USER: "audit_owner",
  POSTGRES_DB: "universident_security_test",
  POSTGRES_PASSWORD: password,
  APP_DATABASE_URL: "",
  BETTER_AUTH_URL: "http://localhost:3100",
  BETTER_AUTH_SECRET: "local-security-test-only-placeholder-secret",
  RESEND_API_KEY: "local-only-no-email",
  EMAIL_FROM: "test@example.invalid",
  OPENAI_API_KEY: "local-only-no-openai",
  CHAT_WORKER_SECRET: "local-security-test-only-worker-secret",
  PUBLIC_REQUEST_IP_HEADER: "",
  CHAT_KEEP_TEST_DB: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: root, env: baseEnv, encoding: "utf8", timeout: 180_000, ...options,
  });
  assert.equal(result.status, 0, `${program} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

assert.ok(!process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT, "Use the verified local Docker context without overrides");
assert.match(command("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]), /^unix:\/\//, "Only a local Unix Docker socket is allowed");

for (const runtimeUrl of ["", "postgresql://universident_app:synthetic@db:5432/universident_security_test?schema=public"]) {
  const config = JSON.parse(command("docker", ["compose", "--env-file", "/dev/null", "-f", "compose-production.yaml", "--profile", "tools", "config", "--format", "json"], {
    env: { ...baseEnv, APP_DATABASE_URL: runtimeUrl },
  }));
  const appUrl = new URL(config.services.app.environment.DATABASE_URL);
  const migrationUrl = new URL(config.services.migrate.environment.DATABASE_URL);
  assert.equal(appUrl.username, runtimeUrl ? "universident_app" : "audit_owner");
  assert.equal(migrationUrl.username, "audit_owner");
  assert.equal(migrationUrl.password, password);
  assert.equal(Number(config.services.app.mem_limit), 2 * 1024 ** 3);
  assert.equal(Number(config.services.db.mem_limit), 3 * 1024 ** 3);
  assert.equal(config.services.app.ports[0].host_ip, "127.0.0.1");
  assert.equal(config.services.db.ports, undefined);
}
console.log("PASS: Compose preserves the original connection, separates runtime/migration credentials and limits resources.");

const nginxDirectory = mkdtempSync(join(tmpdir(), "universident-nginx-test-"));
const nginxConfig = join(nginxDirectory, "nginx.conf");
writeFileSync(nginxConfig, `events {}\nhttp {\ninclude /security/public-limits-http.conf;\nserver {\nlisten 8080;\nserver_name universident.test;\ninclude /security/public-limits-server.conf;\nlocation / {\ninclude /security/trusted-client-ip-location.conf;\nproxy_pass http://127.0.0.1:3000;\n}\n}\n}\n`);
try {
  command("docker", ["run", "--rm", "--network", "none", "--label", `universident.security-test=${label}`,
    "--mount", `type=bind,src=${join(root, "ops/nginx")},dst=/security,readonly`,
    "--mount", `type=bind,src=${nginxDirectory},dst=/security-test,readonly`,
    "--entrypoint", "nginx", "nginx:1.28-alpine", "-t", "-c", "/security-test/nginx.conf"]);
  console.log("PASS: nginx validates all three configuration snippets together.");
} finally {
  unlinkSync(nginxConfig);
  rmdirSync(nginxDirectory);
}

let container;
let owner;
let runtime;
try {
  container = command("docker", ["run", "--detach", "--rm", "--name", label,
    "--label", `universident.security-test=${label}`,
    "--publish", "127.0.0.1::5432", "--tmpfs", "/var/lib/postgresql",
    "--env", "POSTGRES_USER", "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB", "postgres:18.4"]);
  assert.match(container, /^[0-9a-f]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "audit_owner", "-d", baseEnv.POSTGRES_DB], { encoding: "utf8" });
    if (result.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Temporary local PostgreSQL did not start");
  const mapping = command("docker", ["port", container, "5432/tcp"]);
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const databaseUrl = `postgresql://audit_owner:${password}@${mapping}/${baseEnv.POSTGRES_DB}?schema=public`;
  assert.equal(new URL(databaseUrl).hostname, "127.0.0.1");
  command("npx", ["--no-install", "prisma", "migrate", "deploy"], { env: { ...baseEnv, DATABASE_URL: databaseUrl } });
  owner = new Client({ connectionString: databaseUrl });
  await owner.connect();
  command("docker", ["exec", "--interactive", container, "psql", "-U", "audit_owner", "-d", baseEnv.POSTGRES_DB], {
    input: readFileSync(join(root, "ops/postgres/runtime-role.sql"), "utf8"),
  });
  // The setup must be idempotent without changing an existing role's password.
  command("docker", ["exec", "--interactive", container, "psql", "-U", "audit_owner", "-d", baseEnv.POSTGRES_DB], {
    input: readFileSync(join(root, "ops/postgres/runtime-role.sql"), "utf8"),
  });
  await owner.query(`ALTER ROLE universident_app PASSWORD '${password}'`);
  const runtimeUrl = new URL(databaseUrl); runtimeUrl.username = "universident_app";
  runtime = new Client({ connectionString: runtimeUrl.toString() });
  await runtime.connect();
  await runtime.query("BEGIN");
  await runtime.query("SET CONSTRAINTS ALL DEFERRED");
  await runtime.query("SELECT pg_advisory_xact_lock(42001)");
  await runtime.query('INSERT INTO "user" (id, name, email, "emailVerified", role, "updatedAt") VALUES ($1, $2, $3, true, $4, now())', ["runtime-test", "Nume fictiv", "runtime@example.invalid", "STUDENT"]);
  await runtime.query('INSERT INTO student_profile (id, "userId", university, "studyYear", "updatedAt") VALUES ($1, $2, $3, $4, now())', ["runtime-profile", "runtime-test", "UMFCD", 4]);
  assert.equal((await runtime.query('SELECT name FROM "user" WHERE id = $1', ["runtime-test"])).rows[0].name, "Nume fictiv");
  await runtime.query('UPDATE "user" SET name = $1 WHERE id = $2', ["Nume modificat", "runtime-test"]);
  await runtime.query('DELETE FROM student_profile WHERE id = $1', ["runtime-profile"]);
  await runtime.query('DELETE FROM "user" WHERE id = $1', ["runtime-test"]);
  await runtime.query("ROLLBACK");
  for (const sql of ["SELECT * FROM _prisma_migrations", 'TRUNCATE "user"', 'DROP TABLE "user"', "CREATE TABLE forbidden_runtime_table (id integer)", "CREATE ROLE forbidden_runtime_role"]) {
    await assert.rejects(runtime.query(sql), (error) => error.code === "42501", sql);
  }
  await owner.query("CREATE TABLE public.future_runtime_test (id integer)");
  await runtime.query("INSERT INTO public.future_runtime_test VALUES (1)");
  assert.equal((await runtime.query("SELECT id FROM public.future_runtime_test")).rows[0].id, 1);
  console.log("PASS: restricted role supports app CRUD/transactions/locks and future tables, while denying schema, role and migration-history access.");

  // Existing auth/chat integration creates a separate random database on this
  // disposable container and injects its own fake email/moderation providers.
  const integration = command(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/test-chat-integration.ts"], {
    env: { ...baseEnv, DATABASE_URL: databaseUrl },
  });
  console.log(integration.split(/\r?\n/).filter((line) => line.startsWith("PASS:")).join("\n"));
} finally {
  await runtime?.end();
  await owner?.end();
  if (container) {
    const actual = command("docker", ["inspect", "--format", '{{index .Config.Labels "universident.security-test"}}', container]);
    assert.equal(actual, label, "Refuse to remove a container not created by this test");
    command("docker", ["rm", "--force", container]);
  }
}
