import { AppointmentStatus, StudentAvailabilitySeriesStatus } from "@/generated/prisma/enums";
import { localDateForInstant } from "@/lib/availability/bucharest-time";
import { materializeSeriesThrough } from "@/lib/availability/materializer";
import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";
import { prisma } from "@/lib/prisma";

export async function listPublicStudentAvailability(
  publicSlug: string,
  treatmentSlug: string,
  citySlug: string,
  from: Date,
  to: Date,
) {
  if (to <= from || to.getTime() - from.getTime() > 120 * 86_400_000) return null;
  return prisma.$transaction(async (transaction) => {
    const student = await transaction.studentProfile.findFirst({
      where: { publicSlug, isPublished: true },
      select: { id: true },
    });
    if (!student) return null;
    const series = await transaction.studentAvailabilitySeries.findMany({
      where: { studentProfileId: student.id, status: StudentAvailabilitySeriesStatus.ACTIVE },
      orderBy: { id: "asc" },
      include: { offerings: true },
    });
    for (const item of series) {
      await materializeSeriesThrough(transaction, item, localDateForInstant(to));
    }

    const blocks = await transaction.studentAvailabilitySlot.findMany({
      where: {
        studentProfileId: student.id,
        status: "ACTIVE",
        startsAt: { lt: to },
        endsAt: { gt: from },
        studentLocation: {
          deletedAt: null,
          city: { slug: citySlug, isActive: true },
        },
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
          where: { status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } },
          select: { scheduledStartsAt: true, scheduledEndsAt: true },
        },
      },
    });

    const blockById = new Map(blocks.map((block) => [block.id, block]));
    const generated = generateSmartBookingSlots(
      blocks.flatMap((block) => {
        const offering = block.offerings.find(
          (item) => item.studentTreatment.treatment.slug === treatmentSlug,
        );
        if (!offering) return [];
        return [{
          id: block.id,
          offeringId: offering.id,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          treatmentDurationMinutes: offering.studentTreatment.durationMinutes,
          offeredDurationsMinutes: block.offerings.map((item) => item.studentTreatment.durationMinutes),
          occupied: block.appointments.map((appointment) => ({
            startsAt: appointment.scheduledStartsAt,
            endsAt: appointment.scheduledEndsAt,
          })),
        }];
      }),
      new Date(Math.max(Date.now(), from.getTime())),
    );

    const displaySlots: Array<{
      availabilitySlotId: string;
      offeringId: string;
      startsAt: Date;
      endsAt: Date;
      optimized: boolean;
      startOptions: Date[];
    }> = [];
    for (const slot of generated.filter((item) => item.startsAt < to && item.endsAt > from)) {
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
            city: block.studentLocation.city,
          },
          supervisor: {
            fullName: offering.supervisor.fullName,
            academicTitle: offering.supervisor.academicTitle,
          },
        };
      });
  });
}
