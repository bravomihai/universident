"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { StudentCardFeedback } from "@/components/student/student-card-feedback";

const DEFAULT_FEEDBACK_DURATION_MS = 5_000;

export function useCardFeedback(
  durationMs = DEFAULT_FEEDBACK_DURATION_MS,
) {
  const [feedbackById, setFeedbackById] = useState<
    Record<string, StudentCardFeedback>
  >({});
  const timers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const isMounted = useRef(true);

  const cancelTimer = useCallback((resourceId: string) => {
    const timer = timers.current.get(resourceId);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(resourceId);
    }
  }, []);

  const clearFeedback = useCallback(
    (resourceId: string) => {
      cancelTimer(resourceId);

      if (!isMounted.current) {
        return;
      }

      setFeedbackById((currentFeedback) => {
        if (!(resourceId in currentFeedback)) {
          return currentFeedback;
        }

        const nextFeedback = {
          ...currentFeedback,
        };
        delete nextFeedback[resourceId];
        return nextFeedback;
      });
    },
    [cancelTimer],
  );

  const showFeedback = useCallback(
    (resourceId: string, feedback: StudentCardFeedback) => {
      cancelTimer(resourceId);

      if (!isMounted.current) {
        return;
      }

      setFeedbackById((currentFeedback) => ({
        ...currentFeedback,
        [resourceId]: feedback,
      }));

      const timer = setTimeout(() => {
        timers.current.delete(resourceId);

        if (!isMounted.current) {
          return;
        }

        setFeedbackById((currentFeedback) => {
          if (!(resourceId in currentFeedback)) {
            return currentFeedback;
          }

          const nextFeedback = {
            ...currentFeedback,
          };
          delete nextFeedback[resourceId];
          return nextFeedback;
        });
      }, durationMs);

      timers.current.set(resourceId, timer);
    },
    [cancelTimer, durationMs],
  );

  useEffect(() => {
    isMounted.current = true;
    const activeTimers = timers.current;

    return () => {
      isMounted.current = false;

      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }

      activeTimers.clear();
    };
  }, []);

  return {
    feedbackById,
    showFeedback,
    clearFeedback,
  };
}
