import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentTreatmentFormController } from "@/components/student/student-treatment-form-controller";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";
import { studentTreatmentSelect } from "@/lib/student-treatments/student-treatment-data";

export const metadata: Metadata = {
  title: "Editează tratamentul",
  description:
    "Editează un tratament din profilul profesional de student.",
};

type EditStudentTreatmentPageProps = {
  params: Promise<{
    treatmentSlug: string;
  }>;
};

export default async function EditStudentTreatmentPage({
  params,
}: EditStudentTreatmentPageProps) {
  const session = await requireStudentPageSession();
  const { treatmentSlug } = await params;
  const studentProfile = await prisma.studentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!studentProfile) {
    notFound();
  }

  const [studentTreatment, locations, supervisors] = await Promise.all([
    prisma.studentTreatment.findFirst({
      where: {
        studentProfileId: studentProfile.id,
        deletedAt: null,
        treatment: {
          slug: treatmentSlug,
        },
      },
      select: studentTreatmentSelect,
    }),
    prisma.studentLocation.findMany({
      where: {
        studentProfileId: studentProfile.id,
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
    }),
    prisma.studentSupervisor.findMany({
      where: {
        studentProfileId: studentProfile.id,
      },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        academicTitle: true,
        isActive: true,
        deletedAt: true,
      },
    }),
  ]);

  if (!studentTreatment) {
    notFound();
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
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
            Editează tratamentul
          </h1>
          <p className="text-muted-foreground">
            Modifică descrierea, durata, locațiile asociate și starea
            tratamentului.
          </p>
        </div>

        <StudentTreatmentFormController
          mode="edit"
          studentTreatmentId={studentTreatment.id}
          initialValues={{
            treatmentId: studentTreatment.treatmentId,
            name: studentTreatment.treatment.name,
            catalogDescription:
              studentTreatment.treatment.description,
            description: studentTreatment.description,
            durationMinutes: studentTreatment.durationMinutes,
            locationAssignments: studentTreatment.treatmentLocations
              .filter((association) => association.isActive)
              .map((association) => ({
                studentLocationId: association.studentLocation.id,
                supervisorId: association.supervisorId,
              })),
            isActive: studentTreatment.isActive,
          }}
          catalogTreatments={[]}
          locations={locations.map((location) => ({
            id: location.id,
            name: location.name,
            address: location.address,
            cityName: location.city.name,
            isActive: location.isActive,
          }))}
          supervisors={supervisors.map((supervisor) => ({
            ...supervisor,
            deletedAt: supervisor.deletedAt?.toISOString() ?? null,
          }))}
          isDisabled={false}
        />
      </div>
    </main>
  );
}
