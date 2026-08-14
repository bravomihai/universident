import { AppointmentStatus, StudentAvailabilitySeriesStatus } from "@/generated/prisma/enums";
import { localDateForInstant } from "@/lib/availability/bucharest-time";
import { materializeSeriesThrough } from "@/lib/availability/materializer";
import { prisma } from "@/lib/prisma";

export async function listPublicStudentAvailability(
  publicSlug: string,
  from: Date,
  to: Date,
) {
  if (to <= from || to.getTime() - from.getTime() > 120 * 86_400_000) {
    return null;
  }
  return prisma.$transaction(async (transaction) => {
    const student = await transaction.studentProfile.findFirst({
      where: { publicSlug, isPublished: true },
      select: { id: true },
    });
    if (!student) return null;
    const series = await transaction.studentAvailabilitySeries.findMany({
      where: {
        studentProfileId: student.id,
        status: StudentAvailabilitySeriesStatus.ACTIVE,
      },
    });
    for (const item of series) {
      await materializeSeriesThrough(transaction, item, localDateForInstant(to));
    }
    return transaction.studentAvailabilitySlot.findMany({
      where: {
        studentProfileId: student.id,
        status: "ACTIVE",
        startsAt: { gt: from, lt: to },
        treatmentLocation: {
          isActive: true,
          deletedAt: null,
          studentTreatment: { isActive: true, deletedAt: null },
          studentLocation: { isActive: true, deletedAt: null },
          supervisor: { isActive: true, deletedAt: null },
        },
        appointments: {
          none: { status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } },
        },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        version: true,
        treatmentLocation: {
          select: {
            id: true,
            studentTreatment: {
              select: {
                durationMinutes: true,
                treatment: { select: { name: true, slug: true } },
              },
            },
            studentLocation: {
              select: {
                name: true,
                address: true,
                city: { select: { name: true, slug: true } },
              },
            },
            supervisor: { select: { fullName: true, academicTitle: true } },
          },
        },
      },
    });
  });
}
