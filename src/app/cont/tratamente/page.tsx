import type { Metadata } from "next";

import { StudentTreatmentsManager } from "@/components/student/student-treatments-manager";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";
import { studentTreatmentSelect } from "@/lib/student-treatments/student-treatment-data";

export const metadata: Metadata = {
  title: "Tratamente",
  description:
    "Administrează tratamentele oferite în profilul profesional.",
};

export default async function StudentTreatmentsPage() {
  const session = await requireStudentPageSession();
  const studentProfile = await prisma.studentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      studentTreatments: {
        where: {
          deletedAt: null,
        },
        orderBy: [
          {
            isActive: "desc",
          },
          {
            treatment: {
              name: "asc",
            },
          },
        ],
        select: studentTreatmentSelect,
      },
    },
  });

  const studentTreatments =
    studentProfile?.studentTreatments ?? [];

  const treatments = studentTreatments.map((studentTreatment) => ({
    id: studentTreatment.id,
    treatmentId: studentTreatment.treatmentId,
    treatmentSlug: studentTreatment.treatment.slug,
    name: studentTreatment.treatment.name,
    catalogDescription: studentTreatment.treatment.description,
    description: studentTreatment.description,
    durationMinutes: studentTreatment.durationMinutes,
    isActive: studentTreatment.isActive,
    locations: studentTreatment.treatmentLocations
      .filter((association) => association.isActive)
      .map((association) => ({
        id: association.id,
        studentLocationId: association.studentLocation.id,
        name: association.studentLocation.name,
        address: association.studentLocation.address,
        cityName: association.studentLocation.city.name,
        isActive: association.studentLocation.isActive,
        supervisor: {
          id: association.supervisor.id,
          fullName: association.supervisor.fullName,
          academicTitle: association.supervisor.academicTitle,
          isActive: association.supervisor.isActive,
        },
      })),
    createdAt: studentTreatment.createdAt.toISOString(),
    updatedAt: studentTreatment.updatedAt.toISOString(),
  }));

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <StudentTreatmentsManager
          key={treatments
            .flatMap((treatment) =>
              treatment.locations.map(
                (location) =>
                  `${location.id}:${location.supervisor.id}`,
              ),
            )
            .join("|")}
          initialTreatments={treatments}
          hasStudentProfile={Boolean(studentProfile)}
        />
      </div>
    </main>
  );
}
