"use client";

import Link from "next/link";
import {
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EmailVerificationFormProps = {
  emailWasSent?: boolean;
};

const genericSuccessMessage =
  "Dacă adresa corespunde unui cont neverificat, vei primi un nou email de verificare.";

export function EmailVerificationForm({
  emailWasSent = false,
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
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="verification-email">
            Adresă de email
          </Label>
          <Input
            id="verification-email"
            name="email"
            type="email"
            autoComplete="email"
            ref={emailInputRef}
            required
          />
        </div>

        {statusMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
        >
          {isPending
            ? "Se trimite..."
            : "Retrimite emailul de verificare"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Ai verificat deja adresa?{" "}
        <Link
          href="/autentificare"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Continuă către autentificare
        </Link>
      </p>
    </div>
  );
}
