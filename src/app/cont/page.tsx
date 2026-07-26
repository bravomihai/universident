import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StudentVerificationStatusBadge } from "@/components/student/student-verification-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const studentProfile =
    session.user.role === UserRole.STUDENT
      ? await prisma.studentProfile.findUnique({
          where: {
            userId: session.user.id,
          },
          select: {
            university: true,
            studyYear: true,
            verificationStatus: true,
          },
        })
      : null;

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
            Aici poți gestiona informațiile și activitatea contului.
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

        {session.user.role === UserRole.STUDENT ? (
          <Card>
            <CardHeader>
              <CardTitle>Profil profesional</CardTitle>

              <CardDescription>
                Informațiile prin care pacienții te vor putea găsi.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {studentProfile ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Universitate
                    </p>
                    <p className="font-medium">
                      {studentProfile.university}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      An de studiu
                    </p>
                    <p className="font-medium">
                      Anul {studentProfile.studyYear}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Statusul verificării
                    </p>
                    <StudentVerificationStatusBadge
                      status={studentProfile.verificationStatus}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Profilul profesional nu este completat încă.
                </p>
              )}

              <Link
                href="/cont/profil-student"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
              >
                {studentProfile
                  ? "Editează profilul"
                  : "Completează profilul"}
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
