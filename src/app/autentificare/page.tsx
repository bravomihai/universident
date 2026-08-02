import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthFormCard } from "@/components/auth/auth-form-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Autentificare",
  description: "Autentifică-te în contul tău Universident.",
};

export default async function SignInPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect(
      session.user.emailVerified ? "/cont" : "/verifica-email",
    );
  }

  return (
    <AuthFormCard
      title="Autentificare"
      description="Introdu datele contului tău Universident."
    >
      <SignInForm />
    </AuthFormCard>
  );
}
