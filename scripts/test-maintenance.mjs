import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

// Isolated nginx routing test: no .env, application, database or email provider.
// Default: local Docker. Optional: MAINTENANCE_NGINX_BINARY=/absolute/nginx.
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "universident-maintenance-test-"));
// The container worker must be able to read this public, synthetic fixture.
chmodSync(directory, 0o755);
const binary = process.env.MAINTENANCE_NGINX_BINARY;
const nginxRoot = binary ? directory : "/maintenance-test";
const label = `universident-maintenance-${randomUUID()}`;
let processHandle;
let container;

function command(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, `${program}: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  return result.stdout.trim();
}

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function request(base, path, options = {}) {
  return fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(2000), ...options });
}

try {
  const port = binary ? await freePort() : 8080;
  copyFileSync(join(root, "ops/maintenance/index.html"), join(directory, "index.html"));
  for (const name of ["public-limits-http.conf", "public-limits-server.conf", "trusted-client-ip-location.conf"]) {
    copyFileSync(join(root, "ops/nginx", name), join(directory, name));
  }
  const snippet = readFileSync(join(root, "ops/nginx/maintenance-server.conf"), "utf8")
    .replaceAll("/var/www/universident-maintenance", nginxRoot);
  writeFileSync(join(directory, "maintenance-server.conf"), snippet);
  // More specific API/static locations must not bypass the server-level guard.
  const application = 'add_header X-Test-App "synthetic" always; return 200 "synthetic app";';
  writeFileSync(join(directory, "nginx.conf"), `
pid ${nginxRoot}/nginx.pid;
error_log ${nginxRoot}/error.log warn;
events { worker_connections 64; }
http {
  access_log off;
  client_body_temp_path ${nginxRoot}/client-body;
  proxy_temp_path ${nginxRoot}/proxy-temp;
  fastcgi_temp_path ${nginxRoot}/fastcgi-temp;
  uwsgi_temp_path ${nginxRoot}/uwsgi-temp;
  scgi_temp_path ${nginxRoot}/scgi-temp;
  # Exercise hosts that otherwise cache negative file lookups for one minute.
  open_file_cache max=100 inactive=60s;
  open_file_cache_valid 60s;
  open_file_cache_errors on;
  include ${nginxRoot}/public-limits-http.conf;
  server {
    listen ${port};
    server_name universident.test;
    include ${nginxRoot}/maintenance-server.conf;
    include ${nginxRoot}/public-limits-server.conf;
    location / {
      include ${nginxRoot}/trusted-client-ip-location.conf;
      ${application}
    }
    location = /api/health { ${application} }
    location ^~ /_next/ { ${application} }
    location ~ ^/api/auth/ { ${application} }
    location = /__test_app_offline { return 502; }
  }
}
`);

  let base;
  if (binary) {
    assert.ok(isAbsolute(binary), "Use an absolute nginx binary path");
    command(binary, ["-t", "-p", `${directory}/`, "-c", join(directory, "nginx.conf")]);
    processHandle = spawn(binary, ["-p", `${directory}/`, "-c", join(directory, "nginx.conf"), "-g", "daemon off;"], { stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
  } else {
    assert.ok(!process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT, "Refuse Docker endpoint overrides");
    const endpoint = command("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
    assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/, "Only a local Docker daemon is allowed");
    container = command("docker", ["run", "--detach", "--rm", "--label", `universident.maintenance-test=${label}`,
      "--publish", "127.0.0.1::8080", "--mount", `type=bind,src=${directory},dst=${nginxRoot}`,
      "nginx:1.28-alpine", "nginx", "-c", `${nginxRoot}/nginx.conf`, "-g", "daemon off;"]);
    assert.match(container, /^[0-9a-f]{64}$/);
    const mapping = command("docker", ["port", container, "8080/tcp"]);
    assert.match(mapping, /^127\.0\.0\.1:\d+$/);
    base = `http://${mapping}`;
  }

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await request(base, "/__test_ready");
      await response.text();
      if (response.status === 200) { ready = true; break; }
    } catch { /* The isolated nginx process is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `nginx did not start: ${readFileSync(join(directory, "error.log"), "utf8")}`);

  for (const path of ["/", "/studenti", "/api/health", "/_next/static/test.js", "/api/auth/test"]) {
    const response = await request(base, path);
    assert.equal(response.status, 200, `Inactive maintenance changed ${path}`);
    assert.equal(response.headers.get("x-test-app"), "synthetic");
    assert.equal(response.headers.get("retry-after"), null);
    await response.text();
  }
  const offline = await request(base, "/__test_app_offline");
  assert.equal(offline.status, 502);
  await offline.text();
  console.log("PASS: inactive maintenance preserves existing exact, prefix and regex locations.");

  writeFileSync(join(directory, "enabled"), "");
  for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    for (const path of ["/", "/studenti/profil-test", "/cont", "/cont/conversatii/test", "/api/health?test=1", "/api/programari", "/api/auth/test", "/_next/static/test.js", "/__test_app_offline"]) {
      const response = await request(base, path, { method });
      assert.equal(response.status, 503, `${method} ${path} bypassed maintenance`);
      assert.equal(response.headers.get("x-test-app"), null);
      assert.equal(response.headers.get("retry-after"), "3600");
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.match(response.headers.get("content-type"), /text\/html; charset=utf-8/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
      assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
      assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
      assert.equal(response.headers.get("etag"), null);
      const body = await response.text();
      if (method === "HEAD") assert.equal(body, "");
      else assert.match(body, /Universident este temporar indisponibil/);
    }
  }
  const conditional = await request(base, "/", { headers: { "If-Modified-Since": "Wed, 31 Dec 2036 23:59:59 GMT", Range: "bytes=0-15" } });
  assert.equal(conditional.status, 503, "Conditional/range requests must not turn maintenance into 304/206");
  await conditional.text();
  const internal = await request(base, "/__universident_maintenance.html");
  assert.equal(internal.status, 404, "The error page must remain internal");
  await internal.text();
  console.log("PASS: all HTTP methods and application/API/static routes receive the standalone 503 page with no-cache/security headers, including when the app is unavailable.");

  unlinkSync(join(directory, "enabled"));
  const resumed = await request(base, "/api/health");
  assert.equal(resumed.status, 200, "Removing the flag must restore the app without a reload");
  assert.equal(resumed.headers.get("x-test-app"), "synthetic");
  await resumed.text();
  console.log("PASS: removing the flag immediately restores application routing without reloading nginx.");
} finally {
  if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
    const closed = once(processHandle, "exit");
    processHandle.kill("SIGQUIT");
    await closed;
  }
  if (container) {
    assert.equal(command("docker", ["inspect", "--format", '{{index .Config.Labels "universident.maintenance-test"}}', container]), label);
    command("docker", ["rm", "--force", container]);
  }
  assert.equal(dirname(directory), tmpdir(), "Cleanup is limited to this test's temporary directory");
  rmSync(directory, { recursive: true, force: true });
}
