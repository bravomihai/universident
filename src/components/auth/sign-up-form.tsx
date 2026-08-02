"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { AccountTypeSwitcher } from "@/components/auth/account-type-switcher";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";

type SignUpFormProps = {
  accountType?: "patient" | "student";
};

export function SignUpForm({
  accountType = "patient",
}: SignUpFormProps) {
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedAccountType, setSelectedAccountType] = useState<
    "patient" | "student"
  >(accountType);

  const isStudent = selectedAccountType === "student";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const { error } = await authClient.signUp.email(
        {
          name,
          email,
          password,
          callbackURL: "/verifica-email?verificat=1",
        },
        {
          headers: {
            "x-universident-account-type": selectedAccountType,
          },
        },
      );

      if (error) {
        setErrorMessage(
          "Contul nu a putut fi creat. Verifică datele și încearcă din nou.",
        );
        return;
      }

      try {
        window.sessionStorage.setItem(
          "universident-verification-email",
          email.trim(),
        );
      } catch {
        // Formularul de retrimitere rămâne utilizabil manual.
      }

      router.replace("/verifica-email?trimis=1");
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
    <AuthFormCard
      title={
        isStudent
          ? "Creează un cont de student"
          : "Creează un cont de pacient"
      }
      description={
        isStudent
          ? "Completează datele pentru a crea un cont de student."
          : "Completează datele pentru a crea un cont de pacient."
      }
    >
      <div className="space-y-4">
        <AccountTypeSwitcher
          value={selectedAccountType}
          onChange={setSelectedAccountType}
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthFormField htmlFor="name" label="Nume">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
            />
          </AuthFormField>

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
              autoComplete="new-password"
              minLength={8}
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
            pendingText="Se creează contul..."
          >
            {isStudent
              ? "Creează cont de student"
              : "Creează cont de pacient"}
          </PendingSubmitButton>
        </form>
      </div>
    </AuthFormCard>
  );
}
