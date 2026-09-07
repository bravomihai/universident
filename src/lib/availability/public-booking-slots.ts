import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";

export type PublicBookingBlock = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  offerings: {
    id: string;
    studentTreatment: {
      durationMinutes: number;
      treatment: { slug: string };
    };
  }[];
  appointments: { scheduledStartsAt: Date; scheduledEndsAt: Date }[];
};

// Both the profile cards and the calendar use this exact slicing pipeline.
export function generatePublicBookingSlots(
  blocks: PublicBookingBlock[],
  treatmentSlug: string,
  from: Date,
  to: Date,
  now: Date,
) {
  return generateSmartBookingSlots(
    blocks.filter((block) => block.startsAt < to && block.endsAt > from).flatMap((block) => {
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
    new Date(Math.max(now.getTime(), from.getTime())),
  ).filter((slot) => slot.startsAt < to && slot.endsAt > from);
}
