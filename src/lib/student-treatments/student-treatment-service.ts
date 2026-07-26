import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { studentTreatmentSelect } from "@/lib/student-treatments/student-treatment-data";
import type {
  CreateStudentTreatmentInput,
  UpdateStudentTreatmentInput,
} from "@/lib/student-treatments/student-treatment-input";

export type StudentTreatmentDomainErrorCode =
  | "TREATMENT_NOT_FOUND"
  | "TREATMENT_ARCHIVED"
  | "CATALOG_TREATMENT_INVALID"
  | "TREATMENT_ALREADY_ADDED"
  | "LOCATIONS_INVALID"
  | "ACTIVATION_REQUIRES_LOCATION"
  | "DEACTIVATION_CONFIRMATION_REQUIRED";

export class StudentTreatmentDomainError extends Error {
  constructor(
    readonly code: StudentTreatmentDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type ValidatedLocation = {
  id: string;
  isActive: boolean;
};

async function validateOwnedLocations(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  locationIds: string[],
): Promise<ValidatedLocation[]> {
  if (locationIds.length === 0) {
    return [];
  }

  const locations = await transaction.studentLocation.findMany({
    where: {
      id: {
        in: locationIds,
      },
      studentProfileId,
      deletedAt: null,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (locations.length !== locationIds.length) {
    throw new StudentTreatmentDomainError(
      "LOCATIONS_INVALID",
      "Una sau mai multe locații nu există, sunt arhivate sau nu îți aparțin.",
    );
  }

  return locations;
}

export async function createStudentTreatment(
  studentProfileId: string,
  input: CreateStudentTreatmentInput,
) {
  return prisma.$transaction(
    async (transaction) => {
      const catalogTreatment = await transaction.treatment.findFirst({
        where: {
          id: input.treatmentId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!catalogTreatment) {
        throw new StudentTreatmentDomainError(
          "CATALOG_TREATMENT_INVALID",
          "Tratamentul selectat nu există sau nu este disponibil.",
        );
      }

      const duplicate = await transaction.studentTreatment.findFirst({
        where: {
          studentProfileId,
          treatmentId: input.treatmentId,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (duplicate) {
        if (duplicate.deletedAt) {
          throw new StudentTreatmentDomainError(
            "TREATMENT_ARCHIVED",
            "Acest tratament a fost arhivat și nu poate fi adăugat din nou.",
          );
        }

        throw new StudentTreatmentDomainError(
          "TREATMENT_ALREADY_ADDED",
          "Ai adăugat deja acest tratament.",
        );
      }

      const locations = await validateOwnedLocations(
        transaction,
        studentProfileId,
        input.locationIds,
      );

      if (
        input.isActive &&
        !locations.some((location) => location.isActive)
      ) {
        throw new StudentTreatmentDomainError(
          "ACTIVATION_REQUIRES_LOCATION",
          "Tratamentul poate fi activat numai dacă are cel puțin o locație activă asociată.",
        );
      }

      const studentTreatment =
        await transaction.studentTreatment.create({
          data: {
            studentProfileId,
            treatmentId: input.treatmentId,
            description: input.description,
            durationMinutes: input.durationMinutes,
            isActive: input.isActive,
          },
          select: {
            id: true,
          },
        });

      if (input.locationIds.length > 0) {
        await transaction.studentTreatmentLocation.createMany({
          data: input.locationIds.map((studentLocationId) => ({
            studentProfileId,
            studentTreatmentId: studentTreatment.id,
            studentLocationId,
            isActive: true,
          })),
        });
      }

      return transaction.studentTreatment.findUniqueOrThrow({
        where: {
          id: studentTreatment.id,
        },
        select: studentTreatmentSelect,
      });
    },
    {
      isolationLevel: "Serializable",
    },
  );
}

async function updateTreatmentLocationAssociations(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  studentTreatmentId: string,
  locationIds: string[],
) {
  const existingAssociations =
    await transaction.studentTreatmentLocation.findMany({
      where: {
        studentProfileId,
        studentTreatmentId,
      },
      select: {
        id: true,
        studentLocationId: true,
      },
    });

  const associationsByLocationId = new Map(
    existingAssociations.map((association) => [
      association.studentLocationId,
      association,
    ]),
  );

  for (const studentLocationId of locationIds) {
    const existingAssociation =
      associationsByLocationId.get(studentLocationId);

    if (existingAssociation) {
      await transaction.studentTreatmentLocation.update({
        where: {
          id: existingAssociation.id,
        },
        data: {
          isActive: true,
          deletedAt: null,
        },
      });
    } else {
      await transaction.studentTreatmentLocation.create({
        data: {
          studentProfileId,
          studentTreatmentId,
          studentLocationId,
          isActive: true,
        },
      });
    }
  }

  await transaction.studentTreatmentLocation.updateMany({
    where: {
      studentProfileId,
      studentTreatmentId,
      deletedAt: null,
      ...(locationIds.length > 0
        ? {
            studentLocationId: {
              notIn: locationIds,
            },
          }
        : {}),
    },
    data: {
      isActive: false,
    },
  });
}

export async function updateStudentTreatment(
  studentProfileId: string,
  studentTreatmentId: string,
  input: UpdateStudentTreatmentInput,
) {
  return prisma.$transaction(
    async (transaction) => {
      const existingTreatment =
        await transaction.studentTreatment.findFirst({
          where: {
            id: studentTreatmentId,
            studentProfileId,
          },
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        });

      if (!existingTreatment) {
        throw new StudentTreatmentDomainError(
          "TREATMENT_NOT_FOUND",
          "Tratamentul nu a fost găsit.",
        );
      }

      if (existingTreatment.deletedAt) {
        throw new StudentTreatmentDomainError(
          "TREATMENT_ARCHIVED",
          "Tratamentul este arhivat și nu mai poate fi modificat.",
        );
      }

      let selectedLocations: ValidatedLocation[];

      if (input.data.locationIds !== undefined) {
        selectedLocations = await validateOwnedLocations(
          transaction,
          studentProfileId,
          input.data.locationIds,
        );
      } else {
        const currentAssociations =
          await transaction.studentTreatmentLocation.findMany({
            where: {
              studentProfileId,
              studentTreatmentId,
              isActive: true,
              deletedAt: null,
              studentLocation: {
                deletedAt: null,
              },
            },
            select: {
              studentLocation: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
            },
          });

        selectedLocations = currentAssociations.map(
          (association) => association.studentLocation,
        );
      }

      const hasActiveLocation = selectedLocations.some(
        (location) => location.isActive,
      );

      if (
        input.data.isActive === true &&
        !existingTreatment.isActive &&
        !hasActiveLocation
      ) {
        throw new StudentTreatmentDomainError(
          "ACTIVATION_REQUIRES_LOCATION",
          "Tratamentul poate fi activat numai dacă are cel puțin o locație activă asociată.",
        );
      }

      let nextIsActive =
        input.data.isActive ?? existingTreatment.isActive;

      if (nextIsActive && !hasActiveLocation) {
        if (!input.confirmDeactivate) {
          throw new StudentTreatmentDomainError(
            "DEACTIVATION_CONFIRMATION_REQUIRED",
            "Tratamentul nu va mai avea nicio locație activă și trebuie dezactivat.",
          );
        }

        nextIsActive = false;
      }

      if (input.data.locationIds !== undefined) {
        await updateTreatmentLocationAssociations(
          transaction,
          studentProfileId,
          studentTreatmentId,
          input.data.locationIds,
        );
      }

      await transaction.studentTreatment.update({
        where: {
          id: studentTreatmentId,
        },
        data: {
          ...(input.data.description !== undefined
            ? {
                description: input.data.description,
              }
            : {}),
          ...(input.data.durationMinutes !== undefined
            ? {
                durationMinutes: input.data.durationMinutes,
              }
            : {}),
          isActive: nextIsActive,
        },
      });

      return transaction.studentTreatment.findUniqueOrThrow({
        where: {
          id: studentTreatmentId,
        },
        select: studentTreatmentSelect,
      });
    },
    {
      isolationLevel: "Serializable",
    },
  );
}

export async function archiveStudentTreatment(
  studentProfileId: string,
  studentTreatmentId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const existingTreatment =
        await transaction.studentTreatment.findFirst({
          where: {
            id: studentTreatmentId,
            studentProfileId,
          },
          select: {
            id: true,
            deletedAt: true,
          },
        });

      if (!existingTreatment) {
        throw new StudentTreatmentDomainError(
          "TREATMENT_NOT_FOUND",
          "Tratamentul nu a fost găsit.",
        );
      }

      if (existingTreatment.deletedAt) {
        throw new StudentTreatmentDomainError(
          "TREATMENT_ARCHIVED",
          "Tratamentul este deja arhivat.",
        );
      }

      const archivedAt = new Date();

      await transaction.studentTreatment.update({
        where: {
          id: studentTreatmentId,
        },
        data: {
          isActive: false,
          deletedAt: archivedAt,
        },
      });

      await transaction.studentTreatmentLocation.updateMany({
        where: {
          studentProfileId,
          studentTreatmentId,
          deletedAt: null,
        },
        data: {
          isActive: false,
          deletedAt: archivedAt,
        },
      });

      return {
        archivedAt,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}
