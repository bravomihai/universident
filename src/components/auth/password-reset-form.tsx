"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { refreshAuthSession } from "@/lib/auth-client";

const invalidTokenMessage =
  "Linkul de resetare nu este valid sau a expirat. Solicită un link nou.";
const genericErrorMessage =
  "Parola nu a putut fi resetată. Încearcă din nou.";

const errorMessages: Record<string, string> = {
  PASSWORD_TOO_SHORT:
    "Parola trebuie să conțină cel puțin 8 caractere.",
  PASSWORD_TOO_LONG:
    "Parola poate conține cel mult 128 de caractere.",
};

type PasswordResetFormProps = {
  token: string;
};

type FormState = "ready" | "invalid" | "success";

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

export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const submissionInProgress = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [formState, setFormState] =
    useState<FormState>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    window.history.replaceState(
      window.history.state,
      "",
      "/resetare-parola",
    );
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current || formState !== "ready") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(
      formData.get("confirmPassword") ?? "",
    );

    if (newPassword !== confirmPassword) {
      setErrorMessage("Parolele nu coincid.");
      return;
    }

    submissionInProgress.current = true;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          newPassword,
          token,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const code = getResponseCode(payload);

        if (code === "INVALID_TOKEN") {
          setFormState("invalid");
          return;
        }

        setErrorMessage(
          (code && errorMessages[code]) || genericErrorMessage,
        );
        return;
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("status" in payload) ||
        payload.status !== true
      ) {
        setErrorMessage(genericErrorMessage);
        return;
      }

      refreshAuthSession();
      setFormState("success");
    } catch {
      setErrorMessage(genericErrorMessage);
    } finally {
      submissionInProgress.current = false;
      setIsPending(false);
    }
  }

  if (formState === "success") {
    return (
      <div className="space-y-4">
        <p
          role="status"
          aria-live="polite"
          className="text-center text-sm text-muted-foreground"
        >
          Parola a fost resetată. Autentifică-te folosind noua parolă.
        </p>

        <Button asChild className="w-full">
          <Link href="/autentificare">
            Continuă către autentificare
          </Link>
        </Button>
      </div>
    );
  }

  if (formState === "invalid") {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-center text-sm text-destructive">
          {invalidTokenMessage}
        </p>

        <Button asChild className="w-full">
          <Link href="/parola-uitata">Solicită un link nou</Link>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
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

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthFormField
          htmlFor="new-password"
          label="Parolă nouă"
        >
          <PasswordInput
            id="new-password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </AuthFormField>

        <AuthFormField
          htmlFor="confirm-new-password"
          label="Confirmă parola"
        >
          <PasswordInput
            id="confirm-new-password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </AuthFormField>

        <PendingSubmitButton
          isPending={isPending}
          pendingText="Se resetează..."
        >
          Resetează parola
        </PendingSubmitButton>
      </form>

      {errorMessage ? (
        <p
          role="alert"
          className="text-center text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
