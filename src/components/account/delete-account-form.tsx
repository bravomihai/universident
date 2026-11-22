"use client";

import { type SubmitEvent, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export function DeleteAccountForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const currentPassword = new FormData(form).get("currentPassword");
    setPending(true);
    setSent(false);
    setError(null);
    try {
      const response = await fetch("/api/account/stergere", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      if (!response.ok) {
        const body: { error?: string } | null = await response.json().catch(() => null);
        setError(body?.error ?? "Linkul nu a putut fi trimis. Încearcă din nou.");
        return;
      }
      form.reset();
      setSent(true);
    } catch {
      setError("A apărut o eroare de conexiune. Încearcă din nou.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <AuthFormField htmlFor="deletion-password" label="Parola actuală">
        <PasswordInput id="deletion-password" name="currentPassword" autoComplete="current-password" maxLength={128} required disabled={pending} />
      </AuthFormField>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {sent ? <p role="status" className="text-sm text-muted-foreground">Am trimis un link la adresa ta de email. Contul rămâne activ până confirmi ștergerea.</p> : null}
      <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
        {pending ? "Se trimite..." : "Trimite linkul de confirmare"}
      </Button>
    </form>
  );
}
