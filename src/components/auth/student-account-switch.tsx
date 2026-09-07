"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { STUDENT_SIGN_UP_PATH } from "@/lib/auth/student-signup";

export function StudentAccountSwitch() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function continueAsStudent() {
    if (isPending) return;
    setIsPending(true);
    setErrorMessage(null);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setErrorMessage("Deconectarea nu a reușit. Încearcă din nou.");
        return;
      }
      router.replace(STUDENT_SIGN_UP_PATH);
      router.refresh();
    } catch {
      setErrorMessage("A apărut o eroare de conexiune. Încearcă din nou.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthFormCard title="Creează un cont de student" description="Ești deja autentificat într-un cont care nu este de student.">
      <div className="space-y-5">
        <p className="text-base leading-relaxed text-muted-foreground">
          Pentru a crea un cont de student, deconectează-te mai întâi.
          Contul actual se păstrează, iar noul cont va avea nevoie de o altă adresă de email.
        </p>
        {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
        <div className="flex flex-col gap-3">
          <Button type="button" disabled={isPending} aria-busy={isPending} onClick={continueAsStudent}>
            {isPending ? "Se deconectează..." : "Deconectează-mă și continuă >"}
          </Button>
          <Button asChild variant="outline"><Link href="/cont">&lt; Rămân în contul meu</Link></Button>
        </div>
      </div>
    </AuthFormCard>
  );
}
