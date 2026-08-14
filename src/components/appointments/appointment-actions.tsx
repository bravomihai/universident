"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Action = "CONFIRM" | "REJECT" | "CANCEL" | "COMPLETE" | "NO_SHOW";

export function AppointmentActions({
  appointmentSlug,
  version,
  status,
  role,
  startsAt,
  onSuccess,
}: {
  appointmentSlug: string;
  version: number;
  status: string;
  role: "PATIENT" | "STUDENT";
  startsAt: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = new Date(startsAt) <= new Date();

  async function act(action: Action) {
    let reason: string | null = null;
    if (action === "REJECT" || action === "CANCEL") {
      reason = window.prompt("Scrie motivul (minimum 20 de caractere):")?.trim() ?? "";
      if (reason.length < 20) {
        setError("Motivul trebuie să aibă minimum 20 de caractere.");
        return;
      }
    }
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/programari/${encodeURIComponent(appointmentSlug)}/actiuni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: version, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Programarea nu a putut fi actualizată.");
      onSuccess?.();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Programarea nu a putut fi actualizată.");
    } finally {
      setPending(null);
    }
  }

  const patientCanCancel = role === "PATIENT" && !started && (status === "PENDING" || status === "CONFIRMED");
  const studentPending = role === "STUDENT" && !started && status === "PENDING";
  const studentCanCancel = role === "STUDENT" && !started && status === "CONFIRMED";
  const studentCanFinish = role === "STUDENT" && started && status === "CONFIRMED";

  if (!patientCanCancel && !studentPending && !studentCanCancel && !studentCanFinish) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {studentPending ? <Button disabled={pending !== null} onClick={() => void act("CONFIRM")}>Confirmă</Button> : null}
        {studentPending ? <Button variant="destructive" disabled={pending !== null} onClick={() => void act("REJECT")}>Respinge</Button> : null}
        {patientCanCancel || studentCanCancel ? <Button variant="destructive" disabled={pending !== null} onClick={() => void act("CANCEL")}>Anulează</Button> : null}
        {studentCanFinish ? <Button disabled={pending !== null} onClick={() => void act("COMPLETE")}>Finalizată</Button> : null}
        {studentCanFinish ? <Button variant="outline" disabled={pending !== null} onClick={() => void act("NO_SHOW")}>Neprezentare</Button> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
