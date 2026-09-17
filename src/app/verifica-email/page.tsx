import { privateRobots } from "@/lib/seo/metadata";
import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormCard } from "@/components/auth/auth-form-card";
import { EmailVerificationForm } from "@/components/auth/email-verification-form";
import { safeChatReturnTo } from "@/lib/chat/policy";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { robots: privateRobots,
  title: "Verifică adresa de email",
  description:
    "Confirmă adresa de email asociată contului Universident.",
  referrer: "no-referrer",
};

type VerifyEmailPageProps = {
  searchParams: Promise<{
    next?: string | string[];
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
  const returnTo = safeChatReturnTo(firstValue(parameters.next));
  const signInHref = returnTo ? `/autentificare?next=${encodeURIComponent(returnTo)}` : "/autentificare";
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
    <AuthFormCard
      title="Verifică adresa de email"
      description="Introdu adresa de email pentru a retrimite linkul de verificare."
      icon={<MailCheck className="size-5" aria-hidden="true" />}
    >
      <div className="space-y-6">
        {emailWasVerified ? (
          <>
            <p role="status" className="text-sm text-muted-foreground">
              Linkul de verificare a fost procesat. Autentifică-te
              pentru a continua în contul Universident.
            </p>
            <Button asChild className="w-full">
              <Link href={signInHref}>
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
            ) : null}

            <EmailVerificationForm emailWasSent={emailWasSent} signInHref={signInHref} />
          </>
        )}
      </div>
    </AuthFormCard>
  );
}
