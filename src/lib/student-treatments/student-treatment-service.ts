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
  | "RESOURCE_IN_CALENDAR";

export class StudentTreatmentDomainError extends Error {
  constructor(readonly code: StudentTreatmentDomainErrorCode, message: string) {
    super(message);
  }
}

export async function createStudentTreatment(studentProfileId: string, input: CreateStudentTreatmentInput) {
  return prisma.$transaction(async (transaction) => {
    const catalog = await transaction.treatment.findFirst({ where: { id: input.treatmentId, isActive: true } });
    if (!catalog) throw new StudentTreatmentDomainError("CATALOG_TREATMENT_INVALID", "Tratamentul selectat nu este disponibil.");
    const duplicate = await transaction.studentTreatment.findFirst({
      where: { studentProfileId, treatmentId: input.treatmentId },
      select: { deletedAt: true },
    });
    if (duplicate) {
      throw new StudentTreatmentDomainError(
        duplicate.deletedAt ? "TREATMENT_ARCHIVED" : "TREATMENT_ALREADY_ADDED",
        duplicate.deletedAt ? "Acest tratament este arhivat. Restaurează-l din resursele arhivate." : "Ai adăugat deja acest tratament.",
      );
    }
    return transaction.studentTreatment.create({
      data: { studentProfileId, ...input },
      select: studentTreatmentSelect,
    });
  }, { isolationLevel: "Serializable" });
}

export async function updateStudentTreatment(
  studentProfileId: string,
  studentTreatmentId: string,
  input: UpdateStudentTreatmentInput,
) {
  const existing = await prisma.studentTreatment.findFirst({
    where: { id: studentTreatmentId, studentProfileId },
    select: { deletedAt: true },
  });
  if (!existing) throw new StudentTreatmentDomainError("TREATMENT_NOT_FOUND", "Tratamentul nu a fost găsit.");
  if (existing.deletedAt) throw new StudentTreatmentDomainError("TREATMENT_ARCHIVED", "Tratamentul este arhivat.");
  return prisma.studentTreatment.update({ where: { id: studentTreatmentId }, data: input, select: studentTreatmentSelect });
}

export async function archiveStudentTreatment(studentProfileId: string, studentTreatmentId: string) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.studentTreatment.findFirst({
      where: { id: studentTreatmentId, studentProfileId },
      select: { id: true, deletedAt: true },
    });
    if (!existing) throw new StudentTreatmentDomainError("TREATMENT_NOT_FOUND", "Tratamentul nu a fost găsit.");
    if (existing.deletedAt) throw new StudentTreatmentDomainError("TREATMENT_ARCHIVED", "Tratamentul este deja arhivat.");
    const futureUse = await transaction.studentAvailabilitySlotOffering.count({
      where: {
        studentTreatmentId,
        removedAt: null,
        slot: { status: "ACTIVE", startsAt: { gt: new Date() } },
      },
    });
    if (futureUse > 0) {
      throw new StudentTreatmentDomainError("RESOURCE_IN_CALENDAR", "Elimină mai întâi aparițiile viitoare în care oferi acest tratament.");
    }
    const archivedAt = new Date();
    await transaction.studentTreatment.update({ where: { id: studentTreatmentId }, data: { deletedAt: archivedAt } });
    return { archivedAt };
  }, { isolationLevel: "Serializable" });
}
