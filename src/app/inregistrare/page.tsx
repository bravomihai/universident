import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Înregistrare pacient",
  description: "Creează un cont de pacient pe Universident.",
};

export default function PatientSignUpPage() {
  return <SignUpForm />;
}