"use client";

import { useEffect } from "react";

export function AppointmentNotificationsAcknowledger({
  notificationIds,
}: {
  notificationIds: string[];
}) {
  useEffect(() => {
    if (notificationIds.length === 0) return;

    void (async () => {
      for (let offset = 0; offset < notificationIds.length; offset += 1000) {
        const response = await fetch("/api/programari/notificari", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationIds: notificationIds.slice(offset, offset + 1000),
          }),
        });
        if (!response.ok) return;
      }
    })().catch(() => {
      // Păstrăm notificările necitite dacă acknowledgement-ul nu ajunge la server.
    });
  }, [notificationIds]);

  return null;
}
