export const CHAT_POLL_INTERVAL_MS = 3_000;
export const CHAT_CHANGED_EVENT = "universident:chat-read";
const REQUEST_TIMEOUT_MS = 10_000;

type RefreshReason = "initial" | "interval" | "resume" | "change";
type EventSource = Pick<EventTarget, "addEventListener" | "removeEventListener">;
export type ChatPollingRuntime = {
  events: EventSource;
  visibility: EventSource & { readonly visibilityState: string };
  every: (callback: () => void, delay: number) => () => void;
  later: (callback: () => void, delay: number) => () => void;
};

function browserRuntime(): ChatPollingRuntime {
  return {
    events: window,
    visibility: document,
    every: (callback, delay) => {
      const timer = window.setInterval(callback, delay);
      return () => window.clearInterval(timer);
    },
    later: (callback, delay) => {
      const timer = window.setTimeout(callback, delay);
      return () => window.clearTimeout(timer);
    },
  };
}

/** Poll only visible pages and recover from focus, reconnects and stalled requests. */
export function startChatPolling(
  refresh: (signal: AbortSignal, reason: RefreshReason) => Promise<void>,
  runtime: ChatPollingRuntime = browserRuntime(),
) {
  let stopped = false;
  let active: { controller: AbortController; cancelTimeout: () => void } | null = null;
  let queued: RefreshReason | null = null;

  function abortActive() {
    const request = active;
    active = null;
    request?.cancelTimeout();
    request?.controller.abort();
  }

  function poll(reason: RefreshReason) {
    if (stopped || runtime.visibility.visibilityState !== "visible") return;
    if (active) {
      if (reason !== "interval") queued = reason;
      return;
    }
    const request = { controller: new AbortController(), cancelTimeout: () => {} };
    active = request;
    request.cancelTimeout = runtime.later(() => {
      if (active !== request) return;
      abortActive();
      queued = null;
    }, REQUEST_TIMEOUT_MS);
    void Promise.resolve().then(() => {
      if (!request.controller.signal.aborted) return refresh(request.controller.signal, reason);
    }).catch(() => {
      // The consumer owns its error display; a failed request must not stop polling.
    }).finally(() => {
      request.cancelTimeout();
      if (active !== request) return;
      active = null;
      const next = queued;
      queued = null;
      if (next) poll(next);
    });
  }

  const resume = () => poll("resume");
  const changed = () => poll("change");
  const visibilityChanged = () => {
    if (runtime.visibility.visibilityState === "visible") resume();
    else { queued = null; abortActive(); }
  };
  runtime.events.addEventListener("focus", resume);
  runtime.events.addEventListener("online", resume);
  runtime.events.addEventListener("pageshow", resume);
  runtime.events.addEventListener(CHAT_CHANGED_EVENT, changed);
  runtime.visibility.addEventListener("visibilitychange", visibilityChanged);
  const stopInterval = runtime.every(() => poll("interval"), CHAT_POLL_INTERVAL_MS);
  poll("initial");

  return () => {
    stopped = true;
    queued = null;
    abortActive();
    stopInterval();
    runtime.events.removeEventListener("focus", resume);
    runtime.events.removeEventListener("online", resume);
    runtime.events.removeEventListener("pageshow", resume);
    runtime.events.removeEventListener(CHAT_CHANGED_EVENT, changed);
    runtime.visibility.removeEventListener("visibilitychange", visibilityChanged);
  };
}
