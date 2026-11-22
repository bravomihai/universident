"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import Link from "@/components/navigation/app-link";
import { useRouter } from "@/components/navigation/use-app-router";

export function ConfirmAccountDeletion() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    const token = window.location.hash.slice(1);
    if (!token) {
      setError("Deschide linkul complet din emailul de confirmare.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/stergere", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const body: { error?: string } | null = await response.json().catch(() => null);
        setError(body?.error ?? "Contul nu a putut fi șters. Încearcă din nou.");
        return;
      }
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setDeleted(true);
      router.refresh();
    } catch {
      setError("A apărut o eroare de conexiune. Încearcă din nou.");
    } finally {
      setPending(false);
    }
  }

  if (deleted) return (
    <div className="space-y-4">
      <p role="status">Contul tău a fost șters.</p>
      <Button asChild variant="outline"><Link href="/">Pagina principală &gt;</Link></Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Ștergerea este definitivă. Programările viitoare vor fi anulate, iar în istoricul celorlalți vei apărea drept „Cont șters”.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
        {pending ? "Se șterge..." : "Confirmă ștergerea contului"}
      </Button>
    </div>
  );
}
