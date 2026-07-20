"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignUpFormProps = {
  accountType?: "patient" | "student";
};

export function SignUpForm({
  accountType = "patient",
}: SignUpFormProps) {
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isStudent = accountType === "student";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message ?? "Contul nu a putut fi creat.");
        return;
      }

      if (isStudent) {
        const response = await fetch("/api/account/become-student", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          setErrorMessage(
            result.error ??
              "Contul a fost creat, dar rolul de student nu a putut fi atribuit.",
          );
          return;
        }
      }

      router.replace("/");
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {isStudent
            ? "Creează un cont de student"
            : "Creează un cont"}
        </CardTitle>

        <CardDescription>
          {isStudent
            ? "Completează datele pentru a începe configurarea profilului de student."
            : "Completează datele pentru a crea un cont de pacient."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Nume</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Adresă de email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          <Button
            className="w-full"
            type="submit"
            disabled={isPending}
          >
            {isPending
              ? "Se creează contul..."
              : isStudent
                ? "Creează cont de student"
                : "Creează cont"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}