"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { startChatPolling } from "@/lib/chat/polling";

const UnreadChatContext = createContext<number | null>(null);

export function ChatNotificationsProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userId = user?.emailVerified && (user.role === "PATIENT" || user.role === "STUDENT") ? user.id : null;
  const [unread, setUnread] = useState<{ userId: string; count: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    return startChatPolling(async (signal) => {
      const response = await fetch("/api/mesaje/necitite", { cache: "no-store", signal });
      if (response.status === 401 || response.status === 403) {
        if (!signal.aborted) setUnread({ userId, count: 0 });
        return;
      }
      if (!response.ok) return;
      const { count } = await response.json();
      if (!signal.aborted && Number.isSafeInteger(count) && count >= 0) setUnread({ userId, count });
    });
  }, [userId]);

  const count = userId && unread?.userId === userId ? unread.count : null;
  return <UnreadChatContext.Provider value={count}>{children}</UnreadChatContext.Provider>;
}

export function useUnreadChatCount(initialCount = 0) {
  return useContext(UnreadChatContext) ?? initialCount;
}
