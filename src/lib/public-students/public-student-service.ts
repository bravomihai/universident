import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  completeStudentTreatmentLocationWhere,
  completeStudentTreatmentWhere,
  publiclyEligibleStudentProfileWhere,
} from "@/lib/student-publication/student-publication-readiness";

export const PUBLIC_STUDENTS_PAGE_SIZE = 12;

export type PublicCatalogOption = {
  name: string;
  slug: string;
};

export type PublicStudentLocationDto = {
  name: string;
  address: string;
  city: PublicCatalogOption;
  supervisor: {
    fullName: string;
    academicTitle: string | null;
  };
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
  treatment: PublicStudentTreatmentDto;
};

export type PublicStudentProfileDto = {
  name: string;
  image: string | null;
  publicSlug: string;
  university: string;
  studyYear: number;
  bio: string | null;
  treatments: PublicStudentTreatmentDto[];
};

export const getPublicStudentCatalog = cache(async () => {
  const [treatments, cities] = await Promise.all([
    prisma.treatment.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
  ]);

  return { treatments, cities };
});

function mapPublicTreatment(
  treatment: {
    description: string | null;
    durationMinutes: number;
    treatment: {
      name: string;
      slug: string;
      description: string;
    };
    treatmentLocations: Array<{
      studentLocation: {
        name: string;
        address: string;
        city: { name: string; slug: string };
      };
      supervisor: {
        fullName: string;
        academicTitle: string | null;
      };
    }>;
  },
): PublicStudentTreatmentDto {
  return {
    name: treatment.treatment.name,
    slug: treatment.treatment.slug,
    catalogDescription: treatment.treatment.description,
    studentDescription: treatment.description,
    durationMinutes: treatment.durationMinutes,
    locations: treatment.treatmentLocations.map((association) => ({
      name: association.studentLocation.name,
      address: association.studentLocation.address,
      city: association.studentLocation.city,
      supervisor: association.supervisor,
    })),
  };
}

const publicTreatmentSelect = (citySlug?: string) => ({
  description: true,
  durationMinutes: true,
  treatment: {
    select: {
      name: true,
      slug: true,
      description: true,
    },
  },
  treatmentLocations: {
    where: completeStudentTreatmentLocationWhere(citySlug),
    orderBy: [
      { studentLocation: { city: { name: "asc" as const } } },
      { studentLocation: { name: "asc" as const } },
    ],
    select: {
      studentLocation: {
        select: {
          name: true,
          address: true,
          city: { select: { name: true, slug: true } },
        },
      },
      supervisor: {
        select: { fullName: true, academicTitle: true },
      },
    },
  },
});

export const searchPublicStudents = cache(
  async ({
    treatmentSlug,
    citySlug,
    page,
  }: {
    treatmentSlug: string;
    citySlug: string;
    page: number;
  }) => {
    const where = publiclyEligibleStudentProfileWhere({
      treatmentSlug,
      citySlug,
    });
    const skip = (page - 1) * PUBLIC_STUDENTS_PAGE_SIZE;

    const [profiles, totalResults] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        orderBy: [{ user: { name: "asc" } }, { publicSlug: "asc" }],
        skip,
        take: PUBLIC_STUDENTS_PAGE_SIZE,
        select: {
          publicSlug: true,
          university: true,
          studyYear: true,
          bio: true,
          user: { select: { name: true, image: true } },
          studentTreatments: {
            where: completeStudentTreatmentWhere({ treatmentSlug, citySlug }),
            take: 1,
            select: publicTreatmentSelect(citySlug),
          },
        },
      }),
      prisma.studentProfile.count({ where }),
    ]);

    const results: PublicStudentSummaryDto[] = profiles.flatMap((profile) => {
      const treatment = profile.studentTreatments[0];
      if (!profile.publicSlug || !treatment) return [];

      return [
        {
          name: profile.user.name,
          image: profile.user.image,
          publicSlug: profile.publicSlug,
          university: profile.university,
          studyYear: profile.studyYear,
          bio: profile.bio,
          treatment: mapPublicTreatment(treatment),
        },
      ];
    });

    return {
      results,
      totalResults,
      totalPages: Math.max(
        1,
        Math.ceil(totalResults / PUBLIC_STUDENTS_PAGE_SIZE),
      ),
      page,
    };
  },
);

export const getPublicStudentProfile = cache(async (publicSlug: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: {
      ...publiclyEligibleStudentProfileWhere(),
      publicSlug,
    },
    select: {
      publicSlug: true,
      university: true,
      studyYear: true,
      bio: true,
      user: { select: { name: true, image: true } },
      studentTreatments: {
        where: completeStudentTreatmentWhere(),
        orderBy: { treatment: { name: "asc" } },
        select: publicTreatmentSelect(),
      },
    },
  });

  if (!profile?.publicSlug || profile.studentTreatments.length === 0) {
    return null;
  }

  return {
    name: profile.user.name,
    image: profile.user.image,
    publicSlug: profile.publicSlug,
    university: profile.university,
    studyYear: profile.studyYear,
    bio: profile.bio,
    treatments: profile.studentTreatments.map(mapPublicTreatment),
  } satisfies PublicStudentProfileDto;
});
