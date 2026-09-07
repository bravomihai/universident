import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StudentLocationFormController } from "@/components/student/student-location-form-controller";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Adaugă locație",
  description:
    "Adaugă o locație în profilul profesional de student.",
};

export default async function NewStudentLocationPage() {
  const session = await requireStudentPageSession();
  const [studentProfile, cities] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    }),
    prisma.city.findMany({
      where: {
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const isFormDisabled =
    !studentProfile || cities.length === 0;

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <BackLink href="/cont/locatii">Înapoi la locații</BackLink>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              Locație nouă
            </h1>
          </div>
          <p className="text-muted-foreground">
            Adaugă locul concret în care primești pacienți și alege
            orașul din catalogul platformei.
          </p>
        </div>

        {!studentProfile ? (
          <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Completează mai întâi{" "}
            <Link
              href="/cont/profil-student"
              className="font-medium text-foreground underline underline-offset-4"
            >
              profilul profesional
            </Link>{" "}
            înainte de a adăuga o locație.
          </p>
        ) : null}

        {cities.length === 0 ? (
          <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Catalogul platformei nu conține momentan niciun oraș
            activ. Locația nu poate fi salvată și nu vor fi create
            automat orașe.
          </p>
        ) : null}

        <StudentLocationFormController
          mode="create"
          cities={cities}
          isDisabled={isFormDisabled}
        />
      </div>
    </main>
  );
}
