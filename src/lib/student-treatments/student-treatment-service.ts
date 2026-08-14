import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { studentTreatmentSelect } from "@/lib/student-treatments/student-treatment-data";
import type {
  CreateStudentTreatmentInput,
  StudentTreatmentLocationAssignmentInput,
  UpdateStudentTreatmentInput,
} from "@/lib/student-treatments/student-treatment-input";

export type StudentTreatmentDomainErrorCode =
  | "TREATMENT_NOT_FOUND"
  | "TREATMENT_ARCHIVED"
  | "CATALOG_TREATMENT_INVALID"
  | "TREATMENT_ALREADY_ADDED"
  | "LOCATIONS_INVALID"
  | "SUPERVISORS_INVALID"
  | "ACTIVATION_REQUIRES_COMPLETE_ASSIGNMENT"
  | "DEACTIVATION_CONFIRMATION_REQUIRED";

export class StudentTreatmentDomainError extends Error {
  constructor(
    readonly code: StudentTreatmentDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function validateOwnedAssignments(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  assignments: StudentTreatmentLocationAssignmentInput[],
) {
  if (assignments.length === 0) {
    return [];
  }

  const locationIds = assignments.map(
    (assignment) => assignment.studentLocationId,
  );
  const supervisorIds = [
    ...new Set(
      assignments.map((assignment) => assignment.supervisorId),
    ),
  ];

  const [locations, supervisors] = await Promise.all([
    transaction.studentLocation.findMany({
      where: {
        id: { in: locationIds },
        studentProfileId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    }),
    transaction.studentSupervisor.findMany({
      where: {
        id: { in: supervisorIds },
        studentProfileId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);

  if (locations.length !== locationIds.length) {
    throw new StudentTreatmentDomainError(
      "LOCATIONS_INVALID",
      "Una sau mai multe locații nu există, sunt inactive, arhivate sau nu îți aparțin.",
    );
  }

  if (supervisors.length !== supervisorIds.length) {
    throw new StudentTreatmentDomainError(
      "SUPERVISORS_INVALID",
      "Unul sau mai mulți profesori nu există, sunt inactivi, arhivați sau nu îți aparțin.",
    );
  }

  return assignments;
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

      const assignments = await validateOwnedAssignments(
        transaction,
        studentProfileId,
        input.locationAssignments,
      );

      if (input.isActive && assignments.length === 0) {
        throw new StudentTreatmentDomainError(
          "ACTIVATION_REQUIRES_COMPLETE_ASSIGNMENT",
          "Tratamentul poate fi activat numai dacă are cel puțin o locație activă cu profesor atribuit.",
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

      if (assignments.length > 0) {
        await transaction.studentTreatmentLocation.createMany({
          data: assignments.map((assignment) => ({
            studentProfileId,
            studentTreatmentId: studentTreatment.id,
            studentLocationId: assignment.studentLocationId,
            supervisorId: assignment.supervisorId,
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
  assignments: StudentTreatmentLocationAssignmentInput[],
) {
  const existingAssociations =
    await transaction.studentTreatmentLocation.findMany({
      where: {
        studentProfileId,
        studentTreatmentId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        studentLocationId: true,
        supervisorId: true,
      },
    });

  const associationsByLocationId = new Map(
    existingAssociations.map((association) => [
      association.studentLocationId,
      association,
    ]),
  );

  for (const assignment of assignments) {
    const { studentLocationId, supervisorId } = assignment;
    const existingAssociation =
      associationsByLocationId.get(studentLocationId);

    if (existingAssociation?.supervisorId === supervisorId) {
      await transaction.studentTreatmentLocation.update({
        where: {
          id: existingAssociation.id,
        },
        data: {
          supervisorId,
          isActive: true,
          deletedAt: null,
        },
      });
    } else {
      if (existingAssociation) {
        await transaction.studentTreatmentLocation.update({
          where: { id: existingAssociation.id },
          data: { isActive: false, deletedAt: new Date() },
        });
      }
      await transaction.studentTreatmentLocation.create({
        data: {
          studentProfileId,
          studentTreatmentId,
          studentLocationId,
          supervisorId,
          isActive: true,
        },
      });
    }
  }

  await transaction.studentTreatmentLocation.updateMany({
    where: {
      studentProfileId,
      studentTreatmentId,
      isActive: true,
      deletedAt: null,
      ...(assignments.length > 0
        ? {
            studentLocationId: {
              notIn: assignments.map(
                (assignment) => assignment.studentLocationId,
              ),
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

      let hasCompleteActiveConfiguration: boolean;

      if (input.data.locationAssignments !== undefined) {
        const assignments = await validateOwnedAssignments(
          transaction,
          studentProfileId,
          input.data.locationAssignments,
        );
        hasCompleteActiveConfiguration = assignments.length > 0;
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
                  isActive: true,
                  deletedAt: true,
                },
              },
              supervisor: {
                select: {
                  isActive: true,
                  deletedAt: true,
                },
              },
            },
          });

        hasCompleteActiveConfiguration =
          currentAssociations.length > 0 &&
          currentAssociations.every(
            (association) =>
              association.studentLocation.isActive &&
              association.studentLocation.deletedAt === null &&
              association.supervisor.isActive === true &&
              association.supervisor.deletedAt === null,
          );
      }

      if (
        input.data.isActive === true &&
        !existingTreatment.isActive &&
        !hasCompleteActiveConfiguration
      ) {
        throw new StudentTreatmentDomainError(
          "ACTIVATION_REQUIRES_COMPLETE_ASSIGNMENT",
          "Tratamentul poate fi activat numai dacă fiecare locație activă are un profesor disponibil atribuit.",
        );
      }

      let nextIsActive =
        input.data.isActive ?? existingTreatment.isActive;

      if (nextIsActive && !hasCompleteActiveConfiguration) {
        if (!input.confirmDeactivate) {
          throw new StudentTreatmentDomainError(
            "DEACTIVATION_CONFIRMATION_REQUIRED",
            "Tratamentul nu va mai avea o configurație completă de locații și profesori și trebuie dezactivat.",
          );
        }

        nextIsActive = false;
      }

      if (input.data.locationAssignments !== undefined) {
        await updateTreatmentLocationAssociations(
          transaction,
          studentProfileId,
          studentTreatmentId,
          input.data.locationAssignments,
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
