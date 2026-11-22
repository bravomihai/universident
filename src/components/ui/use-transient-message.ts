"use client";

import { useCallback, useEffect, useState } from "react";

export function useTransientMessage(durationMs = 5_000) {
  const [message, setMessage] = useState<{ text: string } | null>(null);

  const showMessage = useCallback((text: string | null) => {
    // A new object restarts the timer even when the same message repeats.
    setMessage(text === null ? null : { text });
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setMessage(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message]);

  return [message?.text ?? null, showMessage] as const;
}
