import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmailVerificationForm } from "@/components/auth/email-verification-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verifică adresa de email",
  description:
    "Confirmă adresa de email asociată contului Universident.",
  referrer: "no-referrer",
};

type VerifyEmailPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    trimis?: string | string[];
    verificat?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const parameters = await searchParams;
  const error = firstValue(parameters.error);
  const emailWasVerified =
    firstValue(parameters.verificat) === "1" && !error;
  const emailWasSent = firstValue(parameters.trimis) === "1";
  const errorMessage =
    error === "TOKEN_EXPIRED"
      ? "Linkul de verificare a expirat. Solicită un email nou."
      : error
        ? "Linkul de verificare nu este valid. Solicită un email nou."
        : null;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="inline-flex size-11 items-center justify-center rounded-full border bg-muted/30">
            <MailCheck className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Verifică adresa de email</CardTitle>
          <CardDescription>
            Confirmarea adresei este obligatorie înainte de folosirea
            contului.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {emailWasVerified ? (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Linkul de verificare a fost procesat. Autentifică-te
                pentru a continua în contul Universident.
              </p>
              <Button asChild className="w-full">
                <Link href="/autentificare">
                  Continuă către autentificare
                </Link>
              </Button>
            </>
          ) : (
            <>
              {errorMessage ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Deschide linkul primit prin email. Linkul este
                  valabil timp de o oră.
                </p>
              )}

              <EmailVerificationForm
                emailWasSent={emailWasSent}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
