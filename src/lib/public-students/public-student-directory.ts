import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RatingSummaryValue } from "@/components/reviews/rating-summary";
import { prisma } from "@/lib/prisma";
import { PUBLIC_STUDENTS_PAGE_SIZE } from "@/lib/public-students/public-student-service";
import type { StudentDirectorySort } from "@/lib/public-students/public-student-directory-order";
import { isPublicDeployment } from "@/lib/seo/config";
import { realStudentProfileWhere } from "@/lib/seo/eligible-students";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";
import { publiclyEligibleStudentProfileWhere } from "@/lib/student-publication/student-publication-readiness";

const profileSelect = {
  id: true,
  publicSlug: true,
  lastRefreshedAt: true,
  university: true,
  studyYear: true,
  showCompletedAppointmentsCount: true,
  user: { select: { id: true, name: true } },
  profileImage: { select: { id: true, updatedAt: true } },
  _count: { select: { appointments: { where: { status: "COMPLETED" } } } },
} satisfies Prisma.StudentProfileSelect;

const orderBy = [
  { lastRefreshedAt: { sort: "desc", nulls: "last" } },
  { publishedAt: { sort: "desc", nulls: "last" } },
  { id: "asc" },
] satisfies Prisma.StudentProfileOrderByWithRelationInput[];

export type PublicStudentDirectoryCardData = {
  publicSlug: string;
  name: string;
  university: string;
  studyYear: number;
  imageUrl: string | null;
  bio: string | null;
  cities: string[];
  treatments: string[];
  refreshedAt: string | null;
  rating: RatingSummaryValue;
  completedAppointmentsCount: number | null;
};

async function getRatings(db: Prisma.TransactionClient, target: Prisma.AppointmentReviewWhereInput) {
  const ratings = await db.appointmentReview.groupBy({
    by: ["targetUserId"],
    where: { ...target, authorRole: "PATIENT", publishedAt: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(ratings.map((entry) => [entry.targetUserId, {
    averageRating: entry._avg.rating,
    reviewCount: entry._count.rating,
  }]));
}

export async function listPublicStudentDirectory({
  page, sort, excludedUserId,
}: {
  page: number;
  sort: StudentDirectorySort;
  excludedUserId?: string;
}) {
  const where = {
    ...publiclyEligibleStudentProfileWhere(),
    ...(isPublicDeployment() ? realStudentProfileWhere() : {}),
    ...(excludedUserId ? { userId: { not: excludedUserId } } : {}),
  };

  return prisma.$transaction(async (db) => {
    const totalResults = await db.studentProfile.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalResults / PUBLIC_STUDENTS_PAGE_SIZE));
    if (page > totalPages) return { results: [], totalResults, totalPages, page };
    const offset = (page - 1) * PUBLIC_STUDENTS_PAGE_SIZE;

    let profiles = await db.studentProfile.findMany({
      where,
      orderBy,
      select: profileSelect,
      // Sorting by recency can paginate directly. The other modes sort aggregates
      // across the directory before taking a page.
      ...(sort === "recent" ? { skip: offset, take: PUBLIC_STUDENTS_PAGE_SIZE } : {}),
    });

    if (sort === "completed") {
      const visibleCount = (profile: (typeof profiles)[number]) =>
        profile.showCompletedAppointmentsCount ? profile._count.appointments : -1;
      profiles = profiles.sort((left, right) => visibleCount(right) - visibleCount(left))
        .slice(offset, offset + PUBLIC_STUDENTS_PAGE_SIZE);
    }

    const ratings = profiles.length > 0
      ? await getRatings(db, sort === "rating"
        ? { target: { studentProfile: where } }
        : { targetUserId: { in: profiles.map((profile) => profile.user.id) } })
      : new Map<string, RatingSummaryValue>();

    if (sort === "rating") {
      profiles = profiles.sort((left, right) => {
        const a = ratings.get(left.user.id);
        const b = ratings.get(right.user.id);
        return (b?.averageRating ?? 0) - (a?.averageRating ?? 0) || (b?.reviewCount ?? 0) - (a?.reviewCount ?? 0);
      }).slice(offset, offset + PUBLIC_STUDENTS_PAGE_SIZE);
    }

    const details = profiles.length > 0 ? await db.studentProfile.findMany({
      where: { id: { in: profiles.map((profile) => profile.id) } },
      select: {
        id: true,
        bio: true,
        locations: {
          where: { deletedAt: null, city: { isActive: true } },
          select: { city: { select: { name: true } } },
        },
        studentTreatments: {
          where: { deletedAt: null, treatment: { isActive: true } },
          select: { treatment: { select: { name: true } } },
        },
      },
    }) : [];
    const detailsById = new Map(details.map((profile) => [profile.id, profile]));

    const results = profiles.flatMap<PublicStudentDirectoryCardData>((profile) => {
      const detail = detailsById.get(profile.id);
      if (!profile.publicSlug || !detail) return [];
      const cities = new Set(detail.locations.map((location) => location.city.name));
      return [{
        publicSlug: profile.publicSlug,
        name: profile.user.name,
        university: profile.university,
        studyYear: profile.studyYear,
        imageUrl: studentProfileImageUrl(profile.profileImage),
        bio: detail.bio?.trim() || null,
        cities: [...cities].sort((a, b) => a.localeCompare(b, "ro")),
        treatments: detail.studentTreatments.map(({ treatment }) => treatment.name).sort((a, b) => a.localeCompare(b, "ro")),
        refreshedAt: profile.lastRefreshedAt?.toISOString() ?? null,
        rating: ratings.get(profile.user.id) ?? { averageRating: null, reviewCount: 0 },
        completedAppointmentsCount: profile.showCompletedAppointmentsCount ? profile._count.appointments : null,
      }];
    });

    return { results, totalResults, totalPages, page };
  }, { isolationLevel: "RepeatableRead" });
}
