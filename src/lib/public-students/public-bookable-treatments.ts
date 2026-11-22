import { generatePublicBookingSlots, type PublicBookingBlock } from "@/lib/availability/public-booking-slots";
import type { PublicStudentTreatmentDto } from "@/lib/public-students/public-student-service";

type ProfileAvailabilityBlock = Omit<PublicBookingBlock, "offerings"> & {
  studentLocation: {
    routeKey: string;
    name: string;
    address: string;
    city: { name: string; slug: string; isActive: boolean };
  };
  offerings: {
    id: string;
    studentTreatment: {
      durationMinutes: number;
      description: string | null;
      treatment: { name: string; slug: string; description: string; isActive: boolean };
    };
  }[];
};

export function getBookablePublicTreatments(
  blocks: ProfileAvailabilityBlock[],
  now: Date,
  through: Date,
): PublicStudentTreatmentDto[] {
  const grouped = new Map<string, PublicStudentTreatmentDto>();
  for (const block of blocks) {
    if (!block.studentLocation.city.isActive) continue;
    for (const offering of block.offerings) {
      const source = offering.studentTreatment;
      if (!source.treatment.isActive) continue;
      const slots = generatePublicBookingSlots([block], source.treatment.slug, now, through, now);
      if (!slots.some((slot) => slot.offeringId === offering.id)) continue;

      let treatment = grouped.get(source.treatment.slug);
      if (!treatment) {
        treatment = {
          name: source.treatment.name,
          slug: source.treatment.slug,
          catalogDescription: source.treatment.description,
          studentDescription: source.description,
          durationMinutes: source.durationMinutes,
          locations: [],
        };
        grouped.set(source.treatment.slug, treatment);
      }
      const location = {
        routeKey: block.studentLocation.routeKey,
        name: block.studentLocation.name,
        address: block.studentLocation.address,
        city: { name: block.studentLocation.city.name, slug: block.studentLocation.city.slug },
      };
      if (!treatment.locations.some((item) => item.routeKey === location.routeKey)) {
        treatment.locations.push(location);
      }
    }
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
}
