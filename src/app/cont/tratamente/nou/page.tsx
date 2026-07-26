import type { Metadata } from "next";
import Link from "next/link";

import { StudentTreatmentFormController } from "@/components/student/student-treatment-form-controller";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Adaugă tratament",
  description:
    "Adaugă un tratament în profilul profesional de student.",
};

export default async function NewStudentTreatmentPage() {
  const session = await requireStudentPageSession();
  const [studentProfile, activeCatalogTreatments] =
    await Promise.all([
      prisma.studentProfile.findUnique({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          studentTreatments: {
            select: {
              treatmentId: true,
            },
          },
          locations: {
            where: {
              deletedAt: null,
            },
            orderBy: [
              {
                isActive: "desc",
              },
              {
                name: "asc",
              },
            ],
            select: {
              id: true,
              name: true,
              address: true,
              isActive: true,
              city: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.treatment.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
    ]);

  const usedTreatmentIds = new Set(
    studentProfile?.studentTreatments.map(
      (studentTreatment) => studentTreatment.treatmentId,
    ) ?? [],
  );
  const availableCatalogTreatments =
    activeCatalogTreatments.filter(
      (treatment) => !usedTreatmentIds.has(treatment.id),
    );
  const locations =
    studentProfile?.locations.map((location) => ({
      id: location.id,
      name: location.name,
      address: location.address,
      cityName: location.city.name,
      isActive: location.isActive,
    })) ?? [];
  const isFormDisabled =
    !studentProfile || availableCatalogTreatments.length === 0;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-3xl space-y-6">
        <Link
          href="/cont/tratamente"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          ← Înapoi la tratamente
        </Link>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Profil profesional
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Tratament nou
          </h1>
          <p className="text-muted-foreground">
            Alege tratamentul din catalog și configurează durata,
            descrierea și locațiile în care îl oferi.
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
            înainte de a adăuga un tratament.
          </p>
        ) : null}

        {activeCatalogTreatments.length === 0 ? (
          <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Catalogul platformei nu conține momentan niciun tratament
            activ. Nu se creează automat tratamente de catalog.
          </p>
        ) : availableCatalogTreatments.length === 0 ? (
          <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Toate tratamentele active din catalog au fost deja
            adăugate anterior profilului. Cele arhivate nu pot fi
            adăugate din nou.
          </p>
        ) : null}

        <StudentTreatmentFormController
          mode="create"
          catalogTreatments={availableCatalogTreatments}
          locations={locations}
          isDisabled={isFormDisabled}
        />
      </div>
    </main>
  );
}
