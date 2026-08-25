import { prisma } from "@/lib/prisma";
import { MAX_RESOURCE_ROOTS_PER_OPERATION } from "@/lib/availability/limits";
import {
  lockSchedulingResourceAndRoots,
  ResourceSchedulingLimitError,
  schedulingResourceUseCounts,
} from "@/lib/availability/resource-locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";
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
  | "RESOURCE_LIMIT_EXCEEDED"
  | "RESOURCE_IN_CALENDAR";

export class StudentTreatmentDomainError extends Error {
  constructor(readonly code: StudentTreatmentDomainErrorCode, message: string) {
    super(message);
  }
}

export async function createStudentTreatment(studentProfileId: string, input: CreateStudentTreatmentInput) {
  return runSerializableTransaction(prisma, async (transaction) => {
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
  });
}

export async function updateStudentTreatment(
  studentProfileId: string,
  studentTreatmentId: string,
  input: UpdateStudentTreatmentInput,
) {
  const now = new Date();
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      await lockSchedulingResourceAndRoots(
        transaction,
        "treatment",
        studentTreatmentId,
        now,
      );
      const existing = await transaction.studentTreatment.findFirst({
        where: { id: studentTreatmentId, studentProfileId },
        select: { deletedAt: true, durationMinutes: true },
      });
      if (!existing) throw new StudentTreatmentDomainError("TREATMENT_NOT_FOUND", "Tratamentul nu a fost găsit.");
      if (existing.deletedAt) throw new StudentTreatmentDomainError("TREATMENT_ARCHIVED", "Tratamentul este arhivat.");

      if (input.durationMinutes !== undefined && input.durationMinutes !== existing.durationMinutes) {
        const shortSeries = await transaction.studentAvailabilitySeries.findFirst({
          where: {
            status: "ACTIVE",
            durationMinutes: { lt: input.durationMinutes },
            offerings: { some: { studentTreatmentId } },
          },
          select: { id: true },
        });
        const futureSlots = await transaction.studentAvailabilitySlot.findMany({
          where: {
            status: "ACTIVE",
            endsAt: { gt: now },
            offerings: { some: { studentTreatmentId, removedAt: null } },
          },
          take: MAX_RESOURCE_ROOTS_PER_OPERATION + 1,
          select: { startsAt: true, endsAt: true },
        });
        if (futureSlots.length > MAX_RESOURCE_ROOTS_PER_OPERATION) {
          throw new ResourceSchedulingLimitError();
        }
        const shortSlot = futureSlots.some(
          (slot) => slot.endsAt.getTime() - slot.startsAt.getTime() < input.durationMinutes! * 60_000,
        );
        if (shortSeries || shortSlot) {
          throw new StudentTreatmentDomainError(
            "RESOURCE_IN_CALENDAR",
            "Noua durată nu încape în toate seriile și aparițiile viitoare care oferă acest tratament.",
          );
        }
      }

      return transaction.studentTreatment.update({
        where: { id: studentTreatmentId },
        data: input,
        select: studentTreatmentSelect,
      });
    });
  } catch (error) {
    if (error instanceof ResourceSchedulingLimitError) {
      throw new StudentTreatmentDomainError("RESOURCE_LIMIT_EXCEEDED", error.message);
    }
    throw error;
  }
}

export async function archiveStudentTreatment(studentProfileId: string, studentTreatmentId: string) {
  const archivedAt = new Date();
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      await lockSchedulingResourceAndRoots(
        transaction,
        "treatment",
        studentTreatmentId,
        archivedAt,
      );
      const existing = await transaction.studentTreatment.findFirst({
        where: { id: studentTreatmentId, studentProfileId },
        select: { id: true, deletedAt: true },
      });
      if (!existing) throw new StudentTreatmentDomainError("TREATMENT_NOT_FOUND", "Tratamentul nu a fost găsit.");
      if (existing.deletedAt) throw new StudentTreatmentDomainError("TREATMENT_ARCHIVED", "Tratamentul este deja arhivat.");
      const use = await schedulingResourceUseCounts(
        transaction,
        "treatment",
        studentTreatmentId,
        archivedAt,
      );
      if (use.activeSeries > 0 || use.futureSlots > 0) {
        throw new StudentTreatmentDomainError("RESOURCE_IN_CALENDAR", "Elimină mai întâi seriile și aparițiile viitoare în care oferi acest tratament.");
      }
      await transaction.studentTreatment.update({
        where: { id: studentTreatmentId },
        data: { deletedAt: archivedAt },
      });
      return { archivedAt };
    });
  } catch (error) {
    if (error instanceof ResourceSchedulingLimitError) {
      throw new StudentTreatmentDomainError("RESOURCE_LIMIT_EXCEEDED", error.message);
    }
    throw error;
  }
}
