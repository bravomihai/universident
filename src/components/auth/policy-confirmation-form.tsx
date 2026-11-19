"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "@/components/navigation/use-app-router";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";

export function PolicyConfirmationForm({ text, version }: { text: string; version: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || new FormData(event.currentTarget).get("confirmedPolicy") !== version) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/confirmari-cont", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, version }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Confirmarea nu a putut fi salvată.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Confirmarea nu a putut fi salvată. Încearcă din nou.");
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
        <input type="checkbox" name="confirmedPolicy" value={version} required disabled={pending} className="mt-1" />
        <span>{text}</span>
      </label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <PendingSubmitButton isPending={pending} pendingText="Se salvează...">Confirmă și continuă</PendingSubmitButton>
    </form>
  );
}
