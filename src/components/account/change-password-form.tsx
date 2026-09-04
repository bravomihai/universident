"use client";

import { type SubmitEvent, useRef, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

const genericErrorMessage =
  "Parola nu a putut fi schimbată. Încearcă din nou.";

const errorMessages: Record<string, string> = {
  INVALID_PASSWORD: "Parola actuală este incorectă.",
  PASSWORD_TOO_SHORT:
    "Parola nouă trebuie să conțină cel puțin 8 caractere.",
  PASSWORD_TOO_LONG:
    "Parola nouă poate conține cel mult 128 de caractere.",
  CREDENTIAL_ACCOUNT_NOT_FOUND:
    "Contul nu are o parolă configurată.",
  SESSION_EXPIRED:
    "Sesiunea a expirat. Autentifică-te din nou și reîncearcă.",
  UNAUTHORIZED:
    "Sesiunea a expirat. Autentifică-te din nou și reîncearcă.",
};

export function ChangePasswordForm() {
  const submissionInProgress = useRef(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
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
    const currentPassword = String(
      formData.get("currentPassword") ?? "",
    );
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmNewPassword = String(
      formData.get("confirmNewPassword") ?? "",
    );

    if (newPassword !== confirmNewPassword) {
      setPasswordMatch(false);
      setErrorMessage(null);
      setStatusMessage(null);
      return;
    }

    setPasswordMatch(true);
    submissionInProgress.current = true;
    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        setErrorMessage(
          (error.code && errorMessages[error.code]) ||
            genericErrorMessage,
        );
        return;
      }

      form.reset();
      setStatusMessage(
        "Parola a fost schimbată. Celelalte sesiuni au fost deconectate.",
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
      <AuthFormField
        htmlFor="current-password"
        label="Parola actuală"
      >
        <PasswordInput
          id="current-password"
          name="currentPassword"
          autoComplete="current-password"
          minLength={8}
          maxLength={128}
          disabled={isPending}
          required
        />
      </AuthFormField>

      <AuthFormField htmlFor="new-password" label="Parola nouă">
        <PasswordInput
          id="new-password"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          disabled={isPending}
          required
        />
      </AuthFormField>

      <AuthFormField
        htmlFor="confirm-new-password"
        label="Confirmă parola nouă"
      >
        <PasswordInput
          id="confirm-new-password"
          name="confirmNewPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-describedby={
            passwordMatch ? undefined : "confirm-new-password-error"
          }
          aria-invalid={!passwordMatch}
          disabled={isPending}
          required
        />
      </AuthFormField>

      {!passwordMatch ? (
        <p
          id="confirm-new-password-error"
          role="alert"
          className="text-sm text-destructive"
        >
          Parolele noi nu coincid.
        </p>
      ) : null}

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
        pendingText="Se schimbă..."
      >
        Schimbă parola
      </PendingSubmitButton>
    </form>
  );
}
