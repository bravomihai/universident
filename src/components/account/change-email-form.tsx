"use client";

import { type SubmitEvent, useRef, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const genericErrorMessage =
  "Adresa de email nu a putut fi schimbată. Încearcă din nou.";

const errorMessages: Record<string, string> = {
  INVALID_PASSWORD: "Parola actuală este incorectă.",
  EMAIL_UNCHANGED:
    "Noua adresă trebuie să fie diferită de adresa actuală.",
  INVALID_EMAIL: "Introdu o adresă de email validă.",
  AUTHENTICATION_REQUIRED:
    "Sesiunea a expirat. Autentifică-te din nou și reîncearcă.",
  EMAIL_NOT_VERIFIED:
    "Adresa actuală trebuie verificată înainte de a fi schimbată.",
  RATE_LIMITED:
    "Ai făcut prea multe încercări. Așteaptă puțin și reîncearcă.",
};

type ChangeEmailFormProps = {
  currentEmail: string;
};

function getResponseCode(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "code" in payload &&
    typeof payload.code === "string"
  ) {
    return payload.code;
  }

  return null;
}

export function ChangeEmailForm({
  currentEmail,
}: ChangeEmailFormProps) {
  const submissionInProgress = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newEmail = String(formData.get("newEmail") ?? "").trim();
    const currentPassword = String(
      formData.get("currentPassword") ?? "",
    );

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setErrorMessage(errorMessages.EMAIL_UNCHANGED);
      setStatusMessage(null);
      return;
    }

    submissionInProgress.current = true;
    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          newEmail,
          currentPassword,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const code = getResponseCode(payload);
        setErrorMessage(
          (code && errorMessages[code]) || genericErrorMessage,
        );
        return;
      }

      form.reset();
      setStatusMessage(
        "Dacă noua adresă poate fi folosită, am trimis un link de verificare. Adresa actuală rămâne activă până la confirmare.",
      );
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      submissionInProgress.current = false;
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthFormField htmlFor="new-email" label="Noua adresă de email">
        <Input
          id="new-email"
          name="newEmail"
          type="email"
          autoComplete="email"
          maxLength={320}
          disabled={isPending}
          required
        />
      </AuthFormField>

      <AuthFormField
        htmlFor="email-current-password"
        label="Parola actuală"
      >
        <PasswordInput
          id="email-current-password"
          name="currentPassword"
          autoComplete="current-password"
          minLength={8}
          maxLength={128}
          disabled={isPending}
          required
        />
      </AuthFormField>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {statusMessage}
        </p>
      ) : null}

      <PendingSubmitButton
        isPending={isPending}
        pendingText="Se trimite..."
      >
        Trimite linkul de verificare
      </PendingSubmitButton>
    </form>
  );
}
