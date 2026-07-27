"use client";

import Link from "next/link";
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Autentificare</CardTitle>
        <CardDescription>
          Introdu datele contului tău Universident.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <Button
            className="w-full"
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Se autentifică..." : "Autentificare"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Nu ai încă un cont?{" "}
            <Link
              href="/inregistrare"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Creează unul
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
