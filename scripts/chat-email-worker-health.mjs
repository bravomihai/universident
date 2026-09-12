import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const HEALTH_MAX_AGE_MS = 120_000;
export const workerHealthFile = () => process.env.CHAT_WORKER_HEALTH_FILE || join(tmpdir(), "universident-chat-email-worker-health.json");

export function isProcessingResult(value) {
  return value !== null && typeof value === "object" &&
    ["sent", "failed", "failedBatches", "overdueBatches"].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0);
}

export function evaluateWorkerHealth(state, now = Date.now()) {
  if (state?.lastErrorCode) return { healthy: false, reason: state.lastErrorCode };
  if (!state || !Number.isSafeInteger(state.lastSuccessAt)) return { healthy: false, reason: "NO_SUCCESSFUL_RUN" };
  const age = now - state.lastSuccessAt;
  if (age < 0 || age > HEALTH_MAX_AGE_MS) return { healthy: false, reason: "STALE_WORKER" };
  if (!isProcessingResult(state.result)) return { healthy: false, reason: "INVALID_STATUS" };
  if (state.result.failedBatches > 0) return { healthy: false, reason: "FAILED_BATCHES" };
  if (state.result.overdueBatches > 0) return { healthy: false, reason: "OVERDUE_BATCHES" };
  if (state.result.failed > 0) return { healthy: false, reason: "DELIVERY_RETRY_PENDING" };
  return { healthy: true, reason: "OK" };
}

export async function writeWorkerHealth(file, state) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, file);
}

export async function readWorkerHealth(file, now = Date.now()) {
  try {
    const state = JSON.parse(await readFile(file, "utf8"));
    return { ...evaluateWorkerHealth(state, now), lastSuccessAt: state.lastSuccessAt ?? null, result: isProcessingResult(state.result) ? state.result : null };
  } catch {
    return { healthy: false, reason: "STATUS_UNAVAILABLE", lastSuccessAt: null, result: null };
  }
}
