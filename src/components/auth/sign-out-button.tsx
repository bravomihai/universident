"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const { error } = await authClient.signOut();

      if (error) {
        setErrorMessage("Deconectarea nu a reușit.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("A apărut o eroare de conexiune.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleSignOut}
      >
        {isPending ? "Se deconectează..." : "Deconectare"}
      </Button>

      {errorMessage ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}