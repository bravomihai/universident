import { generatePublicBookingSlots, type PublicBookingBlock } from "@/lib/availability/public-booking-slots";
import { publicStudentSearchHref } from "@/lib/public-students/public-student-search-pagination";

type Option = { name: string; slug: string };
export type SeoAvailabilityBlock = PublicBookingBlock & {
  studentProfileId: string;
  studentLocation: { city: Option };
  offerings: (PublicBookingBlock["offerings"][number] & {
    studentTreatment: { durationMinutes: number; treatment: Option };
  })[];
};
export type SearchCombination = {
  treatment: Option;
  city: Option;
  href: string;
  studentCount: number;
};

export function bookableSearchCombinations(blocks: SeoAvailabilityBlock[], now: Date, through: Date): SearchCombination[] {
  const combinations = new Map<string, { treatment: Option; city: Option; students: Set<string> }>();
  for (const block of blocks) {
    for (const offering of block.offerings) {
      const treatment = offering.studentTreatment.treatment;
      if (!generatePublicBookingSlots([block], treatment.slug, now, through, now).length) continue;
      const city = block.studentLocation.city;
      const href = publicStudentSearchHref(treatment.slug, city.slug);
      const entry = combinations.get(href) ?? { treatment, city, students: new Set<string>() };
      entry.students.add(block.studentProfileId);
      combinations.set(href, entry);
    }
  }
  return [...combinations.entries()]
    .map(([href, entry]) => ({ href, treatment: entry.treatment, city: entry.city, studentCount: entry.students.size }))
    .sort((a, b) => a.city.name.localeCompare(b.city.name, "ro") || a.treatment.name.localeCompare(b.treatment.name, "ro"));
}
