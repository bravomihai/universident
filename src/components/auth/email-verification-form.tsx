"use client";

import Link from "next/link";
import {
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";

type EmailVerificationFormProps = {
  emailWasSent?: boolean;
  signInHref?: string;
};

const genericSuccessMessage =
  "Dacă adresa corespunde unui cont neverificat, vei primi un nou email de verificare.";

export function EmailVerificationForm({
  emailWasSent = false,
  signInHref = "/autentificare",
}: EmailVerificationFormProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    emailWasSent
      ? "Dacă adresa poate fi verificată, emailul a fost trimis. Verifică și folderul Spam."
      : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    try {
      const storedEmail = window.sessionStorage.getItem(
        "universident-verification-email",
      );

      if (storedEmail && emailInputRef.current) {
        emailInputRef.current.value = storedEmail;
      }
    } catch {
      // Adresa poate fi introdusă manual.
    }
  }, []);

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
      const response = await fetch("/api/email-verification/resend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("RESEND_REQUEST_FAILED");
      }

      try {
        window.sessionStorage.setItem(
          "universident-verification-email",
          normalizedEmail,
        );
      } catch {
        // Retrimiterea a fost deja procesată.
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
          htmlFor="verification-email"
          label="Adresă de email"
        >
          <Input
            id="verification-email"
            name="email"
            type="email"
            autoComplete="email"
            ref={emailInputRef}
            required
          />
        </AuthFormField>

        <PendingSubmitButton
          isPending={isPending}
          pendingText="Se trimite..."
        >
          Retrimite emailul de verificare
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
          Ai verificat deja adresa?{" "}
          <Link
            href={signInHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Continuă către autentificare
          </Link>
        </p>
      </div>
    </div>
  );
}
