import "server-only";

import { cache } from "react";
import { AppointmentStatus, UserRole } from "@/generated/prisma/enums";
import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";
import { prisma } from "@/lib/prisma";
import { getPublishedProfileReviews, type ProfileReviewData } from "@/lib/reviews/profile-review-service";

export const PUBLIC_STUDENTS_PAGE_SIZE = 12;
export type PublicCatalogOption = { name: string; slug: string };
export type PublicStudentLocationDto = {
  routeKey: string;
  name: string;
  address: string;
  city: PublicCatalogOption;
  supervisor: { fullName: string; academicTitle: string | null };
};
export type PublicStudentTreatmentDto = {
  name: string;
  slug: string;
  catalogDescription: string;
  studentDescription: string | null;
  durationMinutes: number;
  locations: PublicStudentLocationDto[];
};
export type PublicStudentSummaryDto = {
  name: string;
  image: string | null;
  publicSlug: string;
  university: string;
  studyYear: number;
  bio: string | null;
  treatment: Omit<PublicStudentTreatmentDto, "locations">;
  location: PublicStudentLocationDto;
};
export type PublicStudentProfileDto = {
  name: string;
  image: string | null;
  publicSlug: string;
  university: string;
  studyYear: number;
  bio: string | null;
  treatments: PublicStudentTreatmentDto[];
  reviewData: ProfileReviewData;
};

export const getPublicStudentCatalog = cache(async () => {
  const [treatments, cities] = await Promise.all([
    prisma.treatment.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.city.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);
  return { treatments, cities };
});

const publicProfileWhere = {
  isPublished: true,
  publicSlug: { not: null },
  university: { not: "" },
  studyYear: { gte: 1, lte: 6 },
  user: { role: UserRole.STUDENT, emailVerified: true },
} as const;

export const searchPublicStudents = cache(async ({ treatmentSlug, citySlug, page, excludedUserId }: { treatmentSlug: string; citySlug: string; page: number; excludedUserId?: string }) => {
  const blocks = await prisma.studentAvailabilitySlot.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { gt: new Date() },
      studentProfile: { ...publicProfileWhere, ...(excludedUserId ? { userId: { not: excludedUserId } } : {}) },
      studentLocation: { deletedAt: null, city: { slug: citySlug, isActive: true } },
      offerings: { some: { removedAt: null, studentTreatment: { deletedAt: null, treatment: { slug: treatmentSlug, isActive: true } }, supervisor: { deletedAt: null } } },
    },
    include: {
      studentProfile: { include: { user: true } },
      studentLocation: { include: { city: true } },
      offerings: { where: { removedAt: null }, include: { studentTreatment: { include: { treatment: true } }, supervisor: true } },
      appointments: { where: { status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } }, select: { scheduledStartsAt: true, scheduledEndsAt: true } },
    },
  });

  const summaries = new Map<string, PublicStudentSummaryDto>();
  for (const block of blocks) {
    const offering = block.offerings.find((item) => item.studentTreatment.treatment.slug === treatmentSlug && !item.studentTreatment.deletedAt && !item.supervisor.deletedAt);
    if (!offering || !block.studentProfile.publicSlug) continue;
    const choices = generateSmartBookingSlots([{
      id: block.id,
      offeringId: offering.id,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      treatmentDurationMinutes: offering.studentTreatment.durationMinutes,
      offeredDurationsMinutes: block.offerings.filter((item) => !item.studentTreatment.deletedAt && !item.supervisor.deletedAt).map((item) => item.studentTreatment.durationMinutes),
      occupied: block.appointments.map((item) => ({ startsAt: item.scheduledStartsAt, endsAt: item.scheduledEndsAt })),
    }]);
    if (choices.length === 0) continue;
    const key = `${block.studentProfile.id}:${offering.studentTreatmentId}:${block.studentLocationId}`;
    if (summaries.has(key)) continue;
    summaries.set(key, {
      name: block.studentProfile.user.name,
      image: block.studentProfile.user.image,
      publicSlug: block.studentProfile.publicSlug,
      university: block.studentProfile.university,
      studyYear: block.studentProfile.studyYear,
      bio: block.studentProfile.bio,
      treatment: {
        name: offering.studentTreatment.treatment.name,
        slug: offering.studentTreatment.treatment.slug,
        catalogDescription: offering.studentTreatment.treatment.description,
        studentDescription: offering.studentTreatment.description,
        durationMinutes: offering.studentTreatment.durationMinutes,
      },
      location: {
        routeKey: block.studentLocation.routeKey,
        name: block.studentLocation.name,
        address: block.studentLocation.address,
        city: { name: block.studentLocation.city.name, slug: block.studentLocation.city.slug },
        supervisor: { fullName: offering.supervisor.fullName, academicTitle: offering.supervisor.academicTitle },
      },
    });
  }
  const all = [...summaries.values()].sort((a, b) => a.name.localeCompare(b.name, "ro") || a.location.name.localeCompare(b.location.name, "ro"));
  const totalResults = all.length;
  return { results: all.slice((page - 1) * PUBLIC_STUDENTS_PAGE_SIZE, page * PUBLIC_STUDENTS_PAGE_SIZE), totalResults, totalPages: Math.max(1, Math.ceil(totalResults / PUBLIC_STUDENTS_PAGE_SIZE)), page };
});

export const getPublicStudentProfile = cache(async (publicSlug: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: { ...publicProfileWhere, publicSlug },
    include: {
      user: true,
      availabilitySlots: {
        where: { status: "ACTIVE", endsAt: { gt: new Date() }, studentLocation: { deletedAt: null } },
        include: {
          studentLocation: { include: { city: true } },
          offerings: { where: { removedAt: null, studentTreatment: { deletedAt: null }, supervisor: { deletedAt: null } }, include: { studentTreatment: { include: { treatment: true } }, supervisor: true } },
        },
      },
    },
  });
  if (!profile?.publicSlug) return null;
  const grouped = new Map<string, PublicStudentTreatmentDto>();
  for (const slot of profile.availabilitySlots) for (const offering of slot.offerings) {
    const source = offering.studentTreatment;
    if (!source.treatment.isActive || !slot.studentLocation.city.isActive) continue;
    let treatment = grouped.get(source.id);
    if (!treatment) {
      treatment = { name: source.treatment.name, slug: source.treatment.slug, catalogDescription: source.treatment.description, studentDescription: source.description, durationMinutes: source.durationMinutes, locations: [] };
      grouped.set(source.id, treatment);
    }
    if (!treatment.locations.some((item) => item.routeKey === slot.studentLocation.routeKey && item.supervisor.fullName === offering.supervisor.fullName)) {
      treatment.locations.push({ routeKey: slot.studentLocation.routeKey, name: slot.studentLocation.name, address: slot.studentLocation.address, city: { name: slot.studentLocation.city.name, slug: slot.studentLocation.city.slug }, supervisor: { fullName: offering.supervisor.fullName, academicTitle: offering.supervisor.academicTitle } });
    }
  }
  const reviewData = await getPublishedProfileReviews(profile.user.id, "STUDENT");
  return { name: profile.user.name, image: profile.user.image, publicSlug: profile.publicSlug, university: profile.university, studyYear: profile.studyYear, bio: profile.bio, treatments: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "ro")), reviewData } satisfies PublicStudentProfileDto;
});
