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
        orderBy: { treatment: { name: "asc" } },
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
    createdAt: studentTreatment.createdAt.toISOString(),
    updatedAt: studentTreatment.updatedAt.toISOString(),
  }));

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <StudentTreatmentsManager
          initialTreatments={treatments}
          hasStudentProfile={Boolean(studentProfile)}
        />
      </div>
    </main>
  );
}
