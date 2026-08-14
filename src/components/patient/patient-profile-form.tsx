"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PatientProfileForm({ initialDateOfBirth }: { initialDateOfBirth: string }) {
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/profil-pacient", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Profilul nu a putut fi salvat.");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profilul nu a putut fi salvat.");
    } finally {
      setPending(false);
    }
  }

  return <form className="space-y-4" onSubmit={submit}>
    <div className="max-w-sm space-y-2"><Label htmlFor="patient-date-of-birth">Data nașterii</Label><Input id="patient-date-of-birth" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /><p className="text-xs text-muted-foreground">Este privată. Studentul vede numai vârsta calculată la data programării.</p></div>
    {saved ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Profilul a fost salvat.</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button disabled={pending}>{pending ? "Se salvează…" : "Salvează"}</Button>
  </form>;
}
