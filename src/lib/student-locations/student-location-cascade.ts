import type { Prisma } from "@/generated/prisma/client";

type StudentTreatmentClient = Pick<
  Prisma.TransactionClient,
  "studentTreatment"
>;

export type AffectedStudentTreatment = {
  id: string;
  name: string;
};

export async function findTreatmentsAffectedByLocationChange(
  client: StudentTreatmentClient,
  studentProfileId: string,
  studentLocationId: string,
): Promise<AffectedStudentTreatment[]> {
  const affectedTreatments = await client.studentTreatment.findMany({
    where: {
      studentProfileId,
      isActive: true,
      deletedAt: null,
      AND: [
        {
          treatmentLocations: {
            some: {
              studentLocationId,
              isActive: true,
              deletedAt: null,
            },
          },
        },
        {
          treatmentLocations: {
            none: {
              studentLocationId: {
                not: studentLocationId,
              },
              isActive: true,
              deletedAt: null,
              studentLocation: {
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      treatment: {
        select: {
          name: true,
        },
      },
    },
  });

  return affectedTreatments.map((studentTreatment) => ({
    id: studentTreatment.id,
    name: studentTreatment.treatment.name,
  }));
}
