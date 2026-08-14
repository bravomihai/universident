import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentLocationFormController } from "@/components/student/student-location-form-controller";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@/lib/prisma";
import { isStudentLocationRouteKey } from "@/lib/student-locations/student-location-route-key";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Editează locația",
  description:
    "Editează o locație din profilul profesional de student.",
};

type EditStudentLocationPageProps = {
  params: Promise<{
    routeKey: string;
  }>;
};

export default async function EditStudentLocationPage({
  params,
}: EditStudentLocationPageProps) {
  const session = await requireStudentPageSession();
  const { routeKey } = await params;

  if (!isStudentLocationRouteKey(routeKey)) {
    notFound();
  }

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

  const [location, cities] = await Promise.all([
    prisma.studentLocation.findFirst({
      where: {
        studentProfileId: studentProfile.id,
        routeKey,
        deletedAt: null,
      },
      select: {
        id: true,
        cityId: true,
        name: true,
        address: true,
        details: true,
      },
    }),
    prisma.city.findMany({
      where: {
        isActive: true,
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

  if (!location) {
    notFound();
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-6">
        <BackLink href="/cont/locatii">Înapoi la locații</BackLink>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              Editează locația
            </h1>
          </div>
          <p className="text-muted-foreground">
            Modifică datele locației fără a schimba adresa sa stabilă
            din navigarea contului.
          </p>
        </div>

        {cities.length === 0 ? (
          <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Catalogul platformei nu conține momentan niciun oraș
            activ. Modificările nu pot fi salvate.
          </p>
        ) : null}

        <StudentLocationFormController
          mode="edit"
          studentLocationId={location.id}
          initialValues={{
            cityId: location.cityId,
            name: location.name,
            address: location.address,
            details: location.details,
          }}
          cities={cities}
          isDisabled={cities.length === 0}
        />
      </div>
    </main>
  );
}
