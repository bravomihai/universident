import type { Metadata } from "next";

import { StudentSupervisorsManager } from "@/components/student/student-supervisors-manager";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Supervizori",
  description: "Administrează profesorii supervizori ai profilului profesional.",
};

export default async function StudentSupervisorsPage() {
  const session = await requireStudentPageSession();
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      supervisors: {
        where: { deletedAt: null },
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          academicTitle: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <StudentSupervisorsManager
          hasStudentProfile={studentProfile !== null}
          initialSupervisors={
            studentProfile?.supervisors.map((supervisor) => ({
              ...supervisor,
              deletedAt: supervisor.deletedAt?.toISOString() ?? null,
              createdAt: supervisor.createdAt.toISOString(),
              updatedAt: supervisor.updatedAt.toISOString(),
            })) ?? []
          }
        />
      </div>
    </main>
  );
}
