import type { Metadata } from "next";

import { StudentLocationsManager } from "@/components/student/student-locations-manager";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Locații",
  description:
    "Administrează locațiile în care primești pacienți.",
};

export default async function StudentLocationsPage() {
  const session = await requireStudentPageSession();
  const studentProfile = await prisma.studentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      locations: {
        where: {
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          cityId: true,
          routeKey: true,
          name: true,
          address: true,
          details: true,
          createdAt: true,
          updatedAt: true,
          city: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const locations =
    studentProfile?.locations.map((location) => ({
      id: location.id,
      cityId: location.cityId,
      routeKey: location.routeKey,
      name: location.name,
      cityName: location.city.name,
      address: location.address,
      details: location.details,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    })) ?? [];

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <StudentLocationsManager
          initialLocations={locations}
          hasStudentProfile={Boolean(studentProfile)}
        />
      </div>
    </main>
  );
}
