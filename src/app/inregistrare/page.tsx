import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Înregistrare",
  description: "Creează un cont pe Universident.",
};

export default async function SignUpPage() {
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
        <SignUpForm />
      </div>
    </main>
  );
}
