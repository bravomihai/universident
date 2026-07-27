import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </main>
  );
}
