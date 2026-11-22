import { prisma } from "@/lib/prisma";
import {
  lockSchedulingResourceAndRoots,
  ResourceSchedulingLimitError,
  schedulingResourceUseCounts,
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

export async function archiveStudentLocation(
  studentProfileId: string,
  resourceId: string,
) {
  const archivedAt = new Date();
  try {
    return await runSerializableTransaction(prisma, async (transaction) => {
      await lockSchedulingResourceAndRoots(transaction, "location", resourceId, archivedAt);
      const resource = await transaction.studentLocation.findFirst({
        where: { id: resourceId, studentProfileId, deletedAt: null },
        select: { id: true },
      });
      if (!resource) {
        throw new ResourceArchiveDomainError("NOT_FOUND", "Resursa nu a fost găsită.");
      }
      const use = await schedulingResourceUseCounts(
        transaction,
        "location",
        resourceId,
        archivedAt,
      );
      if (use.activeSeries > 0 || use.futureSlots > 0) {
        throw new ResourceArchiveDomainError(
          "RESOURCE_IN_CALENDAR",
          "Elimină mai întâi seriile și aparițiile viitoare care folosesc această resursă.",
        );
      }
      await transaction.studentLocation.update({
        where: { id: resourceId },
        data: { deletedAt: archivedAt },
      });
      return { archivedAt };
    });
  } catch (error) {
    if (error instanceof ResourceSchedulingLimitError) {
      throw new ResourceArchiveDomainError("LIMIT_EXCEEDED", error.message);
    }
    throw error;
  }
}
