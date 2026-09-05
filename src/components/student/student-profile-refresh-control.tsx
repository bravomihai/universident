"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PROFILE_REFRESH_COOLDOWN_MS } from "@/lib/student-profile/profile-refresh";

type StudentProfileRefreshControlProps = {
  hasProfile: boolean;
  isPublished: boolean;
  initialLastRefreshedAt: string | null;
  initialNow: string;
};

type RefreshResponse = {
  error?: string;
  lastRefreshedAt?: string;
  nextRefreshAt?: string;
};

function remainingTimeLabel(milliseconds: number) {
  if (milliseconds <= 0) return "Actualizarea este disponibilă acum.";

  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `Mai sunt ${minutes} min până la următoarea actualizare.`;
  }

  return `Mai sunt ${hours} h${minutes ? ` și ${minutes} min` : ""} până la următoarea actualizare.`;
}

export function StudentProfileRefreshControl({
  hasProfile,
  isPublished,
  initialLastRefreshedAt,
  initialNow,
}: StudentProfileRefreshControlProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.parse(initialNow));
  const [lastRefreshedAt, setLastRefreshedAt] = useState(
    initialLastRefreshedAt,
  );
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const nextRefreshTimestamp = lastRefreshedAt
    ? Date.parse(lastRefreshedAt) + PROFILE_REFRESH_COOLDOWN_MS
    : now;
  const remainingMilliseconds = Math.max(0, nextRefreshTimestamp - now);
  const cooldownActive = remainingMilliseconds > 0;
  const canRefresh =
    hasProfile && isPublished && !cooldownActive && !isPending;

  async function refreshProfile() {
    if (!canRefresh) return;

    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/student-profile/refresh", {
        method: "POST",
      });
      const result = (await response.json()) as RefreshResponse;

      if (result.lastRefreshedAt) {
        setLastRefreshedAt(result.lastRefreshedAt);
        setNow(Date.now());
      }

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Profilul nu a putut fi actualizat în rezultate.",
        );
        return;
      }

      setStatusMessage(
        "Profilul a fost actualizat și repoziționat în rezultate.",
      );
      router.refresh();
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const availabilityMessage = !hasProfile
    ? "Salvează mai întâi informațiile profesionale."
    : !isPublished
      ? "Publică profilul pentru a-l putea actualiza în rezultate."
      : remainingTimeLabel(remainingMilliseconds);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Actualizarea manuală repoziționează profilul înaintea profilurilor
        actualizate mai demult. Este disponibilă o dată la 20 de ore.
      </p>

      <p className="text-sm font-medium" aria-live="polite">
        {availabilityMessage}
      </p>

      <Button
        type="button"
        disabled={!canRefresh}
        onClick={() => void refreshProfile()}
      >
        <RefreshCw
          className={isPending ? "animate-spin" : undefined}
          aria-hidden="true"
        />
        {isPending ? "Se actualizează..." : "Actualizează profilul"}
      </Button>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p role="status" className="text-sm text-foreground">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
