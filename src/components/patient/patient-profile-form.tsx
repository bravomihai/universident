"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PatientProfileForm({
  initialName,
  initialDateOfBirth,
  initialBio,
}: {
  initialName: string;
  initialDateOfBirth: string;
  initialBio: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [bio, setBio] = useState(initialBio);
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
        body: JSON.stringify({ name, dateOfBirth, bio }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Profilul nu a putut fi salvat.");
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profilul nu a putut fi salvat.");
    } finally {
      setPending(false);
    }
  }

  return <form className="space-y-4" onSubmit={submit}>
    <div className="max-w-sm space-y-2"><Label htmlFor="patient-name">Nume</Label><Input id="patient-name" name="name" autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /><p className="text-xs text-muted-foreground">Numele apare pe profil și în programările viitoare.</p></div>
    <div className="max-w-sm space-y-2"><Label htmlFor="patient-date-of-birth">Data nașterii</Label><Input id="patient-date-of-birth" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /><p className="text-xs text-muted-foreground">Este privată. Studentul vede numai vârsta calculată la data programării.</p></div>
    <div className="max-w-2xl space-y-2"><Label htmlFor="patient-bio">Despre tine (opțional)</Label><textarea id="patient-bio" maxLength={1000} rows={5} value={bio} onChange={(event) => setBio(event.target.value)} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" placeholder="Poți adăuga informații utile despre tine pentru studenții cu care ai o programare." /><p className="text-xs text-muted-foreground">Descrierea este vizibilă numai studenților cu care ai o cerere sau o programare. Dacă o lași goală, secțiunea nu apare pe profil.</p></div>
    {saved ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Profilul a fost salvat.</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button disabled={pending}>{pending ? "Se salvează…" : "Salvează"}</Button>
  </form>;
}
