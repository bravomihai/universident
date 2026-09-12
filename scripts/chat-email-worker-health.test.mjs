import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { evaluateWorkerHealth, HEALTH_MAX_AGE_MS, isProcessingResult, readWorkerHealth, writeWorkerHealth } from "./chat-email-worker-health.mjs";

const result = { sent: 0, failed: 0, failedBatches: 0, overdueBatches: 0 };
const now = 1_800_000_000_000;
const healthyState = { lastSuccessAt: now, lastErrorCode: null, result };

test("worker health requires a recent successful processing result", () => {
  assert.equal(evaluateWorkerHealth(null, now).healthy, false);
  assert.equal(evaluateWorkerHealth(healthyState, now).healthy, true);
  assert.equal(evaluateWorkerHealth(healthyState, now + HEALTH_MAX_AGE_MS).healthy, true);
  assert.equal(evaluateWorkerHealth(healthyState, now + HEALTH_MAX_AGE_MS + 1).reason, "STALE_WORKER");
  assert.equal(evaluateWorkerHealth(healthyState, now - 1).healthy, false);
});

test("worker health reports failed delivery, exhausted batches and overdue work independently", () => {
  for (const [key, reason] of [["failed", "DELIVERY_RETRY_PENDING"], ["failedBatches", "FAILED_BATCHES"], ["overdueBatches", "OVERDUE_BATCHES"]]) {
    assert.equal(evaluateWorkerHealth({ ...healthyState, result: { ...result, [key]: 1 } }, now).reason, reason);
  }
  assert.equal(evaluateWorkerHealth({ ...healthyState, lastErrorCode: "HTTP_401" }, now).reason, "HTTP_401");
  assert.equal(evaluateWorkerHealth({ ...healthyState, lastErrorCode: "STOPPED" }, now).healthy, false);
  assert.equal(evaluateWorkerHealth(healthyState, now).reason, "OK");
});

test("an incomplete or invalid processing response cannot mark a worker healthy", () => {
  for (const value of [null, {}, { sent: 0, failed: 0 }, { ...result, sent: -1 }, { ...result, failed: "0" }, { ...result, overdueBatches: Infinity }]) {
    assert.equal(isProcessingResult(value), false);
    assert.equal(evaluateWorkerHealth({ ...healthyState, result: value }, now).healthy, false);
  }
});

test("health files fail closed when missing or malformed and recover after an atomic write", async () => {
  const directory = await mkdtemp(join(tmpdir(), "universident-health-test-"));
  const file = join(directory, "status.json");
  try {
    assert.equal((await readWorkerHealth(file, now)).healthy, false);
    await writeFile(file, "{broken");
    assert.equal((await readWorkerHealth(file, now)).healthy, false);
    await writeWorkerHealth(file, healthyState);
    assert.equal((await readWorkerHealth(file, now)).healthy, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("real worker writes health, CLI checks it, and graceful shutdown clears healthy state", { timeout: 15_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "universident-worker-test-"));
  const file = join(directory, "status.json");
  const secret = "fixture-worker-secret-".repeat(3);
  let received = 0;
  const server = createServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/internal/chat-emails");
    assert.equal(request.headers.authorization, `Bearer ${secret}`);
    received++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const env = { ...process.env, CHAT_WORKER_URL: `http://127.0.0.1:${server.address().port}`, CHAT_WORKER_SECRET: secret, CHAT_WORKER_HEALTH_FILE: file };
  const worker = spawn(process.execPath, ["scripts/chat-email-worker.mjs"], { env, stdio: "ignore" });
  const stopped = once(worker, "exit");
  try {
    const deadline = Date.now() + 5_000;
    while (!(await readWorkerHealth(file)).healthy && Date.now() < deadline) await delay(25);
    assert.equal((await readWorkerHealth(file)).healthy, true);
    assert.equal(received, 1);
    const check = spawn(process.execPath, ["scripts/chat-email-worker.mjs", "--healthcheck"], { env, stdio: "ignore" });
    assert.equal((await once(check, "exit"))[0], 0);
    worker.kill("SIGTERM");
    await stopped;
    assert.equal((await readWorkerHealth(file)).reason, "STOPPED");
    const checkStopped = spawn(process.execPath, ["scripts/chat-email-worker.mjs", "--healthcheck"], { env, stdio: "ignore" });
    assert.equal((await once(checkStopped, "exit"))[0], 1);
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) { worker.kill("SIGTERM"); await stopped; }
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
