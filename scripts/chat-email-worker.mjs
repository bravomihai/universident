import { setTimeout } from "node:timers/promises";
import { evaluateWorkerHealth, isProcessingResult, readWorkerHealth, workerHealthFile, writeWorkerHealth } from "./chat-email-worker-health.mjs";

const healthFile = workerHealthFile();
if (process.argv.includes("--healthcheck")) {
  const status = await readWorkerHealth(healthFile);
  console.log(JSON.stringify(status));
  process.exit(status.healthy ? 0 : 1);
}

const baseUrl = process.env.CHAT_WORKER_URL || process.env.BETTER_AUTH_URL;
const secret = process.env.CHAT_WORKER_SECRET;
if (!baseUrl || !secret || secret.length < 32) {
  console.error("Configurează CHAT_WORKER_URL (sau BETTER_AUTH_URL) și CHAT_WORKER_SECRET (minimum 32 de caractere).");
  process.exit(1);
}
const abort = new AbortController();
process.on("SIGTERM", () => abort.abort());
process.on("SIGINT", () => abort.abort());
console.log("Procesarea notificărilor chat este activă.");
const state = { lastSuccessAt: null, lastErrorCode: "STARTING", result: null };
await writeWorkerHealth(healthFile, state);
let previousStatus = "";
while (!abort.signal.aborted) {
  try {
    const response = await fetch(new URL("/api/internal/chat-emails", baseUrl), {
      method: "POST", headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(55_000)]),
    });
    if (!response.ok) {
      state.lastErrorCode = `HTTP_${response.status}`;
    } else {
      const result = await response.json();
      if (!isProcessingResult(result)) throw new Error("INVALID_RESPONSE");
      state.lastSuccessAt = Date.now();
      state.lastErrorCode = null;
      state.result = result;
    }
  } catch { if (!abort.signal.aborted) state.lastErrorCode = "PROCESSING_UNAVAILABLE"; }
  if (abort.signal.aborted) break;
  await writeWorkerHealth(healthFile, state);
  const status = evaluateWorkerHealth(state);
  const summary = JSON.stringify({ ...status, result: state.result });
  if (summary !== previousStatus) {
    (status.healthy ? console.log : console.error)(`Notificări chat: ${summary}`);
    previousStatus = summary;
  }
  try { await setTimeout(15_000, undefined, { signal: abort.signal }); } catch { break; }
}
state.lastErrorCode = "STOPPED";
await writeWorkerHealth(healthFile, state);
