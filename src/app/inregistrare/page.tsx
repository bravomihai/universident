import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { StudentAccountSwitch } from "@/components/auth/student-account-switch";
import { auth } from "@/lib/auth";
import { requiresStudentAccountSwitch, signUpAccountType } from "@/lib/auth/student-signup";

export const metadata: Metadata = {
  title: "Înregistrare",
  description: "Creează un cont pe Universident.",
};

export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const accountType = signUpAccountType((await searchParams).tip);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    if (requiresStudentAccountSwitch(accountType, session.user.role)) {
      return <StudentAccountSwitch />;
    }
    redirect(
      session.user.emailVerified ? "/cont" : "/verifica-email",
    );
  }

  return <SignUpForm key={accountType} accountType={accountType} />;
}
