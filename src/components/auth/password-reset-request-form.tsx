"use client";

import Link from "next/link";
import { type SubmitEvent, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";

const genericSuccessMessage =
  "Dacă adresa corespunde unui cont, vei primi un link valabil timp de o oră.";

export function PasswordResetRequestForm() {
  const [isPending, setIsPending] = useState(false);
  const [statusMessage, setStatusMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const formData = new FormData(event.currentTarget);
    const normalizedEmail = String(
      formData.get("email") ?? "",
    ).trim();

    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("PASSWORD_RESET_REQUEST_FAILED");
      }

      setStatusMessage(genericSuccessMessage);
    } catch {
      setErrorMessage(
        "Cererea nu a putut fi trimisă. Verifică conexiunea și încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthFormField
          htmlFor="password-reset-email"
          label="Adresă de email"
        >
          <Input
            id="password-reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </AuthFormField>
        <PendingSubmitButton
          isPending={isPending}
          pendingText="Se trimite..."
        >
          Trimite linkul de resetare
        </PendingSubmitButton>
      </form>

      <div className="space-y-2">
        {statusMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-sm text-muted-foreground"
          >
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="text-center text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          Ți-ai amintit parola?{" "}
          <Link
            href="/autentificare"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Continuă către autentificare
          </Link>
        </p>
      </div>
    </div>
  );
}
