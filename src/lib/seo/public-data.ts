import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { publicBookingWindowEnd } from "@/lib/availability/public-booking-window";
import { appointmentConsumesCapacityWhere } from "@/lib/appointments/appointment-service";
import { publiclyEligibleStudentProfileWhere } from "@/lib/student-publication/student-publication-readiness";
import { realStudentProfileWhere } from "./eligible-students";
import { bookableSearchCombinations } from "./search-combinations";

export function seoStudentProfileWhere() {
  return { AND: [publiclyEligibleStudentProfileWhere(), realStudentProfileWhere()] };
}

export const getSeoStudentProfile = cache(async (publicSlug: string) => {
  return prisma.studentProfile.findFirst({
    where: { ...seoStudentProfileWhere(), publicSlug },
    select: { publicSlug: true, university: true, studyYear: true, user: { select: { name: true } } },
  });
});

export async function getSitemapStudentProfiles() {
  return prisma.studentProfile.findMany({
    where: seoStudentProfileWhere(),
    select: { publicSlug: true },
    orderBy: { publicSlug: "asc" },
  });
}

// Deliberately SELECT-only. SEO must not materialize recurrences, expire
// appointments or read private DTOs. Missing materialized capacity is omitted
// conservatively until the existing calendar/search flow materializes it.
export const getSeoSearchCombinations = cache(async (treatmentSlug?: string, citySlug?: string) => {
  const now = new Date();
  const through = publicBookingWindowEnd(now);
  const blocks = await prisma.studentAvailabilitySlot.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ seriesId: null }, { series: { status: "ACTIVE" } }],
      startsAt: { lt: through },
      endsAt: { gt: now },
      studentProfile: seoStudentProfileWhere(),
      studentLocation: { deletedAt: null, city: { isActive: true, ...(citySlug ? { slug: citySlug } : {}) } },
      ...(treatmentSlug ? { offerings: { some: {
        removedAt: null,
        studentTreatment: { deletedAt: null, treatment: { isActive: true, slug: treatmentSlug } },
        supervisor: { deletedAt: null },
      } } } : {}),
    },
    select: {
      id: true, studentProfileId: true, startsAt: true, endsAt: true,
      studentLocation: { select: { city: { select: { name: true, slug: true } } } },
      offerings: {
        where: { removedAt: null, studentTreatment: { deletedAt: null, treatment: { isActive: true } }, supervisor: { deletedAt: null } },
        select: { id: true, studentTreatment: { select: { durationMinutes: true, treatment: { select: { name: true, slug: true } } } } },
      },
      appointments: {
        where: appointmentConsumesCapacityWhere(now),
        select: { scheduledStartsAt: true, scheduledEndsAt: true },
      },
    },
  });
  return bookableSearchCombinations(blocks, now, through)
    .filter((entry) => !treatmentSlug || entry.treatment.slug === treatmentSlug);
});
