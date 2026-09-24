"use client";

import { useCallback, useEffect, useState } from "react";

export function useTransientMessage() {
  const [message, setMessage] = useState<{ text: string } | null>(null);

  const showMessage = useCallback((text: string | null) => {
    // A new object restarts the timer even when the same message repeats.
    setMessage(text === null ? null : { text });
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setMessage(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return [message?.text ?? null, showMessage] as const;
}
