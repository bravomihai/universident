import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormCard } from "@/components/auth/auth-form-card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Resetare parolă",
  description: "Stabilește o parolă nouă pentru contul Universident.",
  referrer: "no-referrer",
};

type PasswordResetPageProps = {
  searchParams: Promise<{
    token?: string | string[];
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const parameters = await searchParams;
  const token = firstValue(parameters.token);
  const error = firstValue(parameters.error);
  const hasToken = typeof token === "string" && token.trim().length > 0;
  const hasError = error !== undefined;

  if (!hasToken || hasError) {
    return (
      <AuthFormCard
        title="Link de resetare invalid"
        description="Linkul de resetare nu este valid sau a expirat. Solicită un link nou."
        icon={<KeyRound className="size-5" aria-hidden="true" />}
      >
        <div className="space-y-4">
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
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Resetează parola"
      description="Alege o parolă nouă pentru contul tău."
      icon={<KeyRound className="size-5" aria-hidden="true" />}
    >
      <PasswordResetForm token={token} />
    </AuthFormCard>
  );
}
