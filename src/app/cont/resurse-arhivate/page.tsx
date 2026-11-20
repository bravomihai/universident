import type { Metadata } from "next";

import { StudentArchivedResourcesManager } from "@/components/student/student-archived-resources-manager";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Resurse arhivate",
  description:
    "Consultă și restaurează tratamentele și locațiile arhivate.",
};

function serializeArchivedAt(value: Date | null) {
  if (!value) throw new Error("O resursă arhivată trebuie să aibă deletedAt.");
  return value.toISOString();
}

export default async function ArchivedResourcesPage() {
  const session = await requireStudentPageSession();
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [archivedTreatments, archivedLocations] =
    studentProfile
      ? await Promise.all([
          prisma.studentTreatment.findMany({
            where: {
              studentProfileId: studentProfile.id,
              deletedAt: { not: null },
            },
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              description: true,
              durationMinutes: true,
              deletedAt: true,
              treatment: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                },
              },
            },
          }),
          prisma.studentLocation.findMany({
            where: {
              studentProfileId: studentProfile.id,
              deletedAt: { not: null },
            },
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              routeKey: true,
              name: true,
              address: true,
              details: true,
              deletedAt: true,
              city: {
                select: { id: true, name: true, slug: true },
              },
            },
          }),
        ])
      : [[], []];

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <StudentArchivedResourcesManager
          hasStudentProfile={studentProfile !== null}
          initialTreatments={archivedTreatments.map((treatment) => ({
            ...treatment,
            deletedAt: serializeArchivedAt(treatment.deletedAt),
          }))}
          initialLocations={archivedLocations.map((location) => ({
            ...location,
            deletedAt: serializeArchivedAt(location.deletedAt),
          }))}
        />
      </div>
    </main>
  );
}
