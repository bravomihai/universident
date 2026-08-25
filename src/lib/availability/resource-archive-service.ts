import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  lockSchedulingResourceAndRoots,
  ResourceSchedulingLimitError,
  schedulingResourceUseCounts,
  type SchedulingResourceKind,
} from "@/lib/availability/resource-locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

export class ResourceArchiveDomainError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "RESOURCE_IN_CALENDAR" | "LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
  }
}

async function findOwnedResource(
  transaction: Prisma.TransactionClient,
  kind: Exclude<SchedulingResourceKind, "treatment">,
  resourceId: string,
  studentProfileId: string,
) {
  if (kind === "location") {
    return transaction.studentLocation.findFirst({
      where: { id: resourceId, studentProfileId, deletedAt: null },
      select: { id: true },
    });
  }
  return transaction.studentSupervisor.findFirst({
    where: { id: resourceId, studentProfileId, deletedAt: null },
    select: { id: true },
  });
}

export async function archiveStudentSchedulingResource(
  kind: Exclude<SchedulingResourceKind, "treatment">,
  studentProfileId: string,
  resourceId: string,
) {
  const archivedAt = new Date();
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      await lockSchedulingResourceAndRoots(transaction, kind, resourceId, archivedAt);
      const resource = await findOwnedResource(
        transaction,
        kind,
        resourceId,
        studentProfileId,
      );
      if (!resource) {
        throw new ResourceArchiveDomainError("NOT_FOUND", "Resursa nu a fost găsită.");
      }
      const use = await schedulingResourceUseCounts(
        transaction,
        kind,
        resourceId,
        archivedAt,
      );
      if (use.activeSeries > 0 || use.futureSlots > 0) {
        throw new ResourceArchiveDomainError(
          "RESOURCE_IN_CALENDAR",
          "Elimină mai întâi seriile și aparițiile viitoare care folosesc această resursă.",
        );
      }
      if (kind === "location") {
        await transaction.studentLocation.update({
          where: { id: resourceId },
          data: { deletedAt: archivedAt },
        });
      } else {
        await transaction.studentSupervisor.update({
          where: { id: resourceId },
          data: { deletedAt: archivedAt },
        });
      }
      return { archivedAt };
    });
  } catch (error) {
    if (error instanceof ResourceSchedulingLimitError) {
      throw new ResourceArchiveDomainError("LIMIT_EXCEEDED", error.message);
    }
    throw error;
  }
}
