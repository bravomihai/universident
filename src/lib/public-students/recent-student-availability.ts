import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";

type Offering = { id: string; durationMinutes: number; treatmentName: string };
type Block = {
  id: string;
  studentProfileId: string;
  startsAt: Date;
  endsAt: Date;
  cityName: string;
  offerings: Offering[];
  occupied: { startsAt: Date; endsAt: Date }[];
};

export function summarizeRecentStudentAvailability(blocks: Block[], now: Date) {
  const result = new Map<string, { cities: Set<string>; treatments: Set<string> }>();
  for (const block of blocks) {
    for (const offering of block.offerings) {
      const slots = generateSmartBookingSlots([{
        id: block.id,
        offeringId: offering.id,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        treatmentDurationMinutes: offering.durationMinutes,
        offeredDurationsMinutes: block.offerings.map((item) => item.durationMinutes),
        occupied: block.occupied,
      }], now);
      if (slots.length === 0) continue;
      let summary = result.get(block.studentProfileId);
      if (!summary) {
        summary = { cities: new Set(), treatments: new Set() };
        result.set(block.studentProfileId, summary);
      }
      summary.cities.add(block.cityName);
      summary.treatments.add(offering.treatmentName);
    }
  }
  return result;
}
