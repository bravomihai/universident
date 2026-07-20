import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Autentificare",
  description: "Autentifică-te în contul tău Universident.",
};

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </main>
  );
}