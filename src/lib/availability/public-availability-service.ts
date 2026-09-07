import { appointmentConsumesCapacityWhere } from "@/lib/appointments/appointment-service";
import { ensureStudentSeriesMaterializedThrough } from "@/lib/availability/materializer";
import { generatePublicBookingSlots } from "@/lib/availability/public-booking-slots";
import { publicBookingLocationWhere } from "@/lib/public-students/public-booking-location";
import { prisma } from "@/lib/prisma";

export async function listPublicStudentAvailability(
  publicSlug: string,
  treatmentSlug: string,
  citySlug: string,
  from: Date,
  to: Date,
  locationRouteKey?: string,
) {
  if (to <= from || to.getTime() - from.getTime() > 120 * 86_400_000) return null;
  const now = new Date();
  const student = await prisma.studentProfile.findFirst({
      where: { publicSlug, isPublished: true },
      select: { id: true },
  });
  if (!student) return null;
  await ensureStudentSeriesMaterializedThrough(student.id, to, now);
  return prisma.$transaction(async (transaction) => {

    const blocks = await transaction.studentAvailabilitySlot.findMany({
      where: {
        studentProfileId: student.id,
        status: "ACTIVE",
        OR: [{ seriesId: null }, { series: { status: "ACTIVE" } }],
        startsAt: { lt: to },
        endsAt: { gt: from },
        studentLocation: publicBookingLocationWhere(citySlug, locationRouteKey),
        offerings: {
          some: {
            removedAt: null,
            studentTreatment: {
              deletedAt: null,
              treatment: { slug: treatmentSlug, isActive: true },
            },
            supervisor: { deletedAt: null },
          },
        },
      },
      orderBy: { startsAt: "asc" },
      include: {
        studentLocation: { include: { city: true } },
        offerings: {
          where: { removedAt: null, studentTreatment: { deletedAt: null }, supervisor: { deletedAt: null } },
          include: { studentTreatment: { include: { treatment: true } }, supervisor: true },
        },
        appointments: {
          where: appointmentConsumesCapacityWhere(now),
          select: { scheduledStartsAt: true, scheduledEndsAt: true },
        },
      },
    });

    const blockById = new Map(blocks.map((block) => [block.id, block]));
    const generated = generatePublicBookingSlots(blocks, treatmentSlug, from, to, now);

    const displaySlots: Array<{
      availabilitySlotId: string;
      offeringId: string;
      startsAt: Date;
      endsAt: Date;
      optimized: boolean;
      startOptions: Date[];
    }> = [];
    for (const slot of generated) {
      const previous = displaySlots.at(-1);
      const previousStart = previous?.startOptions.at(-1);
      if (
        !slot.optimized &&
        previous &&
        !previous.optimized &&
        previous.availabilitySlotId === slot.availabilitySlotId &&
        previous.offeringId === slot.offeringId &&
        previousStart &&
        slot.startsAt.getTime() - previousStart.getTime() === 15 * 60_000
      ) {
        previous.endsAt = slot.endsAt;
        previous.startOptions.push(slot.startsAt);
      } else {
        displaySlots.push({
          availabilitySlotId: slot.availabilitySlotId,
          offeringId: slot.offeringId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          optimized: slot.optimized,
          startOptions: [slot.startsAt],
        });
      }
    }

    return displaySlots.map((slot) => {
        const block = blockById.get(slot.availabilitySlotId)!;
        const offering = block.offerings.find((item) => item.id === slot.offeringId)!;
        return {
          id: `${block.id}:${slot.offeringId}:${slot.startsAt.toISOString()}`,
          availabilitySlotId: block.id,
          offeringId: slot.offeringId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          optimized: slot.optimized,
          startOptions: slot.startOptions,
          treatment: {
            name: offering.studentTreatment.treatment.name,
            slug: offering.studentTreatment.treatment.slug,
            durationMinutes: offering.studentTreatment.durationMinutes,
          },
          location: {
            name: block.studentLocation.name,
            address: block.studentLocation.address,
            routeKey: block.studentLocation.routeKey,
            city: {
              name: block.studentLocation.city.name,
              slug: block.studentLocation.city.slug,
            },
          },
          supervisor: {
            fullName: offering.supervisor.fullName,
            academicTitle: offering.supervisor.academicTitle,
          },
        };
      });
  });
}
