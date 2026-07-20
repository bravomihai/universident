import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contul meu",
  description: "Gestionează contul tău Universident.",
};

const roleLabels: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Pacient",
  [UserRole.STUDENT]: "Student",
  [UserRole.ADMIN]: "Administrator",
};

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/autentificare");
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Contul meu
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Bun venit, {session.user.name}
          </h1>

          <p className="text-muted-foreground">
            Aici vei putea gestiona informațiile și activitatea contului.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informații despre cont</CardTitle>

            <CardDescription>
              Datele asociate contului tău Universident.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nume</p>
              <p className="font-medium">{session.user.name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Adresă de email
              </p>
              <p className="font-medium">{session.user.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Tipul contului
              </p>
              <p className="font-medium">
                {roleLabels[session.user.role]}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}