import "server-only";

import { cache } from "react";
import { UserRole } from "@/generated/prisma/enums";
import { publicBookingWindowEnd } from "@/lib/availability/public-booking-window";
import { ensureActiveSeriesMaterializedThrough, ensureStudentSeriesMaterializedThrough } from "@/lib/availability/materializer";
import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";
import { appointmentConsumesCapacityWhere } from "@/lib/appointments/appointment-service";
import { prisma } from "@/lib/prisma";
import { createPublicStudentProfile } from "@/lib/public-students/public-student-profile-dto";
import { getBookablePublicTreatments } from "@/lib/public-students/public-bookable-treatments";
import { rankUniquePublicStudents } from "@/lib/public-students/public-student-search-ranking";
import { getPublishedProfileReviews, type ProfileReviewData } from "@/lib/reviews/profile-review-service";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";

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
  imageUrl: string | null;
  publicSlug: string;
  university: string;
  studyYear: number;
  bio: string | null;
  treatment: Omit<PublicStudentTreatmentDto, "locations">;
  city: PublicCatalogOption;
  firstAvailableAt: Date;
  locationCount: number;
};
export type PublicStudentProfileDto = {
  name: string;
  imageUrl: string | null;
  publicSlug: string;
  university: string;
  studyYear: number;
  bio: string | null;
  treatments: PublicStudentTreatmentDto[];
  reviewData: ProfileReviewData;
  cancellationsLast10: number;
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
  const now = new Date();
  await ensureActiveSeriesMaterializedThrough(
    publicBookingWindowEnd(now),
    { treatmentSlug, citySlug, excludedUserId },
    now,
  );
  const blocks = await prisma.studentAvailabilitySlot.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ seriesId: null }, { series: { status: "ACTIVE" } }],
      startsAt: { lt: publicBookingWindowEnd(now) },
      endsAt: { gt: now },
      studentProfile: { ...publicProfileWhere, ...(excludedUserId ? { userId: { not: excludedUserId } } : {}) },
      studentLocation: { deletedAt: null, city: { slug: citySlug, isActive: true } },
      offerings: { some: { removedAt: null, studentTreatment: { deletedAt: null, treatment: { slug: treatmentSlug, isActive: true } }, supervisor: { deletedAt: null } } },
    },
    include: {
      studentProfile: {
        select: {
          id: true,
          publicSlug: true,
          university: true,
          studyYear: true,
          bio: true,
          lastRefreshedAt: true,
          profileImage: { select: { id: true, updatedAt: true } },
          user: { select: { name: true } },
        },
      },
      studentLocation: { include: { city: true } },
      offerings: { where: { removedAt: null }, include: { studentTreatment: { include: { treatment: true } }, supervisor: true } },
      appointments: { where: appointmentConsumesCapacityWhere(now), select: { scheduledStartsAt: true, scheduledEndsAt: true } },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });

  const candidates = [];
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
    }], now);
    if (choices.length === 0) continue;
    candidates.push({
      studentProfileId: block.studentProfile.id,
      studentName: block.studentProfile.user.name,
      profileRefreshedAt: block.studentProfile.lastRefreshedAt,
      locationKey: block.studentLocationId,
      firstAvailableAt: choices[0].startsAt,
      tieBreaker: `${block.studentLocation.routeKey}:${offering.id}`,
      value: {
        name: block.studentProfile.user.name,
        imageUrl: studentProfileImageUrl(block.studentProfile.profileImage),
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
        city: {
          name: block.studentLocation.city.name,
          slug: block.studentLocation.city.slug,
        },
      },
    });
  }
  const all: PublicStudentSummaryDto[] = rankUniquePublicStudents(candidates).map(
    (student) => ({
      ...student.value,
      firstAvailableAt: student.firstAvailableAt,
      locationCount: student.locationCount,
    }),
  );
  const totalResults = all.length;
  return { results: all.slice((page - 1) * PUBLIC_STUDENTS_PAGE_SIZE, page * PUBLIC_STUDENTS_PAGE_SIZE), totalResults, totalPages: Math.max(1, Math.ceil(totalResults / PUBLIC_STUDENTS_PAGE_SIZE)), page };
});

export const getPublicStudentProfile = cache(async (publicSlug: string) => {
  const now = new Date();
  const through = publicBookingWindowEnd(now);
  const profile = await prisma.studentProfile.findFirst({
    where: { ...publicProfileWhere, publicSlug },
    include: {
      user: { select: { id: true, name: true } },
      profileImage: { select: { id: true, updatedAt: true } },
      appointments: {
        where: { confirmedAt: { not: null } },
        orderBy: { scheduledStartsAt: "desc" },
        take: 10,
        select: { status: true },
      },
    },
  });
  if (!profile?.publicSlug) return null;
  await ensureStudentSeriesMaterializedThrough(profile.id, through, now);
  const [blocks, reviewData] = await Promise.all([
    prisma.studentAvailabilitySlot.findMany({
      where: {
        studentProfileId: profile.id,
        status: "ACTIVE",
        startsAt: { lt: through },
        endsAt: { gt: now },
        studentLocation: { deletedAt: null, city: { isActive: true } },
        OR: [{ seriesId: null }, { series: { status: "ACTIVE" } }],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: {
        studentLocation: { include: { city: true } },
        offerings: { where: { removedAt: null, studentTreatment: { deletedAt: null }, supervisor: { deletedAt: null } }, include: { studentTreatment: { include: { treatment: true } }, supervisor: true } },
        appointments: {
          where: appointmentConsumesCapacityWhere(now),
          select: { scheduledStartsAt: true, scheduledEndsAt: true },
        },
      },
    }),
    getPublishedProfileReviews(profile.user.id, "STUDENT"),
  ]);
  return createPublicStudentProfile(
    profile,
    getBookablePublicTreatments(blocks, now, through),
    reviewData,
  );
});
