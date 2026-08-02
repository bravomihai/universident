"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          try {
            window.sessionStorage.setItem(
              "universident-verification-email",
              email.trim(),
            );
          } catch {
            // Formularul de retrimitere rămâne utilizabil manual.
          }

          router.replace("/verifica-email");
          return;
        }

        setErrorMessage("Emailul sau parola sunt incorecte.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthFormField htmlFor="email" label="Adresă de email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </AuthFormField>

      <AuthFormField htmlFor="password" label="Parolă">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </AuthFormField>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <PendingSubmitButton
        isPending={isPending}
        pendingText="Se autentifică..."
      >
        Autentificare
      </PendingSubmitButton>

      <div
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 md:flex-nowrap"
        data-auth-secondary-actions
      >
        <p
          className="shrink-0 text-center text-sm text-muted-foreground"
          data-auth-secondary-action
        >
          Ai uitat parola?{" "}
          <Link
            href="/parola-uitata"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Resetează parola
          </Link>
        </p>

        <p
          className="shrink-0 text-center text-sm text-muted-foreground"
          data-auth-secondary-action
        >
          Nu ai încă un cont?{" "}
          <Link
            href="/inregistrare"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Creează unul
          </Link>
        </p>
      </div>
    </form>
  );
}
