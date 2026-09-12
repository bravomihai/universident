import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_CHANGED_EVENT, CHAT_POLL_INTERVAL_MS, type ChatPollingRuntime, startChatPolling } from "./polling";

function environment() {
  const events = new EventTarget();
  const visibility = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const intervals = new Set<() => void>();
  const timeouts = new Set<() => void>();
  const runtime: ChatPollingRuntime = {
    events, visibility,
    every: (callback, delay) => { assert.equal(delay, CHAT_POLL_INTERVAL_MS); intervals.add(callback); return () => { intervals.delete(callback); }; },
    later: (callback) => { timeouts.add(callback); return () => { timeouts.delete(callback); }; },
  };
  return { runtime, events, visibility, tick: () => [...intervals].forEach((fn) => fn()), expire: () => [...timeouts].forEach((fn) => fn()) };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("chat refreshes on mount and repeatedly without reloading the page", async () => {
  const env = environment();
  const reasons: string[] = [];
  const stop = startChatPolling(async (_signal, reason) => { reasons.push(reason); }, env.runtime);
  await settle();
  env.tick(); await settle(); env.tick(); await settle();
  assert.deepEqual(reasons, ["initial", "interval", "interval"]);
  stop();
});

test("chat resumes immediately when the tab becomes visible, focused or online", async () => {
  const env = environment();
  env.visibility.visibilityState = "hidden";
  let calls = 0;
  const stop = startChatPolling(async () => { calls++; }, env.runtime);
  env.tick(); await settle(); assert.equal(calls, 0);
  env.visibility.visibilityState = "visible";
  env.visibility.dispatchEvent(new Event("visibilitychange")); await settle();
  assert.equal(calls, 1);
  for (const event of ["focus", "online", "pageshow"]) { env.events.dispatchEvent(new Event(event)); await settle(); }
  assert.equal(calls, 4);
  stop();
});

test("a change during a request schedules one follow-up without overlapping requests", async () => {
  const env = environment();
  let release!: () => void;
  let calls = 0;
  const stop = startChatPolling(async () => { calls++; if (calls === 1) await new Promise<void>((resolve) => { release = resolve; }); }, env.runtime);
  await settle();
  env.tick(); env.events.dispatchEvent(new Event(CHAT_CHANGED_EVENT)); env.events.dispatchEvent(new Event(CHAT_CHANGED_EVENT));
  await settle(); assert.equal(calls, 1);
  release(); await settle(); assert.equal(calls, 2);
  stop();
});

test("a stalled request times out and does not freeze future message updates", async () => {
  const env = environment();
  const signals: AbortSignal[] = [];
  let release!: () => void;
  const stop = startChatPolling(async (signal) => {
    signals.push(signal);
    if (signals.length === 1) await new Promise<void>((resolve) => { release = resolve; });
  }, env.runtime);
  await settle(); env.expire();
  assert.equal(signals[0].aborted, true);
  env.tick(); await settle(); assert.equal(signals.length, 2);
  release(); await settle();
  env.tick(); await settle(); assert.equal(signals.length, 3);
  stop();
});

test("hiding or unmounting the chat aborts requests and detaches polling listeners", async () => {
  const env = environment();
  const signals: AbortSignal[] = [];
  const stop = startChatPolling(async (signal) => {
    signals.push(signal);
    await new Promise<void>((resolve) => { signal.addEventListener("abort", () => resolve(), { once: true }); });
  }, env.runtime);
  await settle();
  env.visibility.visibilityState = "hidden";
  env.visibility.dispatchEvent(new Event("visibilitychange")); await settle();
  assert.equal(signals[0].aborted, true);
  env.visibility.visibilityState = "visible";
  env.events.dispatchEvent(new Event("focus")); await settle();
  assert.equal(signals.length, 2);
  stop(); assert.equal(signals[1].aborted, true);
  env.tick(); env.events.dispatchEvent(new Event("online")); await settle();
  assert.equal(signals.length, 2);
});
