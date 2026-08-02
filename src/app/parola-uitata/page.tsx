import { KeyRound } from "lucide-react";
import type { Metadata } from "next";

import { AuthFormCard } from "@/components/auth/auth-form-card";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export const metadata: Metadata = {
  title: "Ai uitat parola?",
  description:
    "Solicită un link pentru resetarea parolei contului Universident.",
  referrer: "no-referrer",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormCard
      title="Ai uitat parola?"
      description="Introdu adresa de email pentru a primi un link de resetare."
      icon={<KeyRound className="size-5" aria-hidden="true" />}
    >
      <PasswordResetRequestForm />
    </AuthFormCard>
  );
}
