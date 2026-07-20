import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Înregistrare student",
  description: "Creează un cont de student pe Universident.",
};

export default function StudentSignUpPage() {
  return <SignUpForm accountType="student" />;
}