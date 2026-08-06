import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type StudentPublicationRequirement = {
  code:
    | "EMAIL_NOT_VERIFIED"
    | "PROFILE_MISSING"
    | "PROFILE_INVALID"
    | "TREATMENT_MISSING"
    | "LOCATION_MISSING"
    | "SUPERVISOR_MISSING"
    | "COMPLETE_OFFER_MISSING";
  message: string;
  href: string;
};

export type StudentPublicationEvaluation = {
  profileId: string | null;
  userName: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  publicSlug: string | null;
  canPublish: boolean;
  isPubliclyVisible: boolean;
  missingRequirements: StudentPublicationRequirement[];
};

export function completeStudentTreatmentLocationWhere(citySlug?: string) {
  return {
    isActive: true,
    deletedAt: null,
    studentLocation: {
      isActive: true,
      deletedAt: null,
      city: {
        isActive: true,
        ...(citySlug ? { slug: citySlug } : {}),
      },
    },
    supervisor: {
      isActive: true,
      deletedAt: null,
    },
  } satisfies Prisma.StudentTreatmentLocationWhereInput;
}

export function completeStudentTreatmentWhere({
  treatmentSlug,
  citySlug,
}: {
  treatmentSlug?: string;
  citySlug?: string;
} = {}) {
  return {
    isActive: true,
    deletedAt: null,
    treatment: {
      isActive: true,
      ...(treatmentSlug ? { slug: treatmentSlug } : {}),
    },
    treatmentLocations: {
      some: completeStudentTreatmentLocationWhere(citySlug),
    },
  } satisfies Prisma.StudentTreatmentWhereInput;
}

export function publiclyEligibleStudentProfileWhere({
  treatmentSlug,
  citySlug,
}: {
  treatmentSlug?: string;
  citySlug?: string;
} = {}) {
  return {
    isPublished: true,
    publicSlug: { not: null },
    university: { not: "" },
    studyYear: { gte: 1, lte: 6 },
    user: {
      role: UserRole.STUDENT,
      emailVerified: true,
    },
    studentTreatments: {
      some: completeStudentTreatmentWhere({ treatmentSlug, citySlug }),
    },
  } satisfies Prisma.StudentProfileWhereInput;
}

export async function evaluateStudentPublication(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<StudentPublicationEvaluation> {
  const profile = await transaction.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      university: true,
      studyYear: true,
      isPublished: true,
      publishedAt: true,
      publicSlug: true,
      user: {
        select: {
          name: true,
          emailVerified: true,
          role: true,
        },
      },
    },
  });

  if (!profile) {
    return {
      profileId: null,
      userName: null,
      isPublished: false,
      publishedAt: null,
      publicSlug: null,
      canPublish: false,
      isPubliclyVisible: false,
      missingRequirements: [
        {
          code: "PROFILE_MISSING",
          message: "Completează profilul profesional.",
          href: "/cont/profil-student",
        },
      ],
    };
  }

  const [activeTreatments, activeLocations, activeSupervisors, completeOffers] =
    await Promise.all([
      transaction.studentTreatment.count({
        where: {
          studentProfileId: profile.id,
          isActive: true,
          deletedAt: null,
          treatment: { isActive: true },
        },
      }),
      transaction.studentLocation.count({
        where: {
          studentProfileId: profile.id,
          isActive: true,
          deletedAt: null,
          city: { isActive: true },
        },
      }),
      transaction.studentSupervisor.count({
        where: {
          studentProfileId: profile.id,
          isActive: true,
          deletedAt: null,
        },
      }),
      transaction.studentTreatment.count({
        where: {
          studentProfileId: profile.id,
          ...completeStudentTreatmentWhere(),
        },
      }),
    ]);

  const missingRequirements: StudentPublicationRequirement[] = [];
  const university = profile.university.trim();
  const profileIsValid =
    university.length >= 2 &&
    university.length <= 120 &&
    Number.isInteger(profile.studyYear) &&
    profile.studyYear >= 1 &&
    profile.studyYear <= 6;

  if (
    profile.user.role !== UserRole.STUDENT ||
    !profile.user.emailVerified
  ) {
    missingRequirements.push({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verifică adresa de email a contului.",
      href: "/verifica-email",
    });
  }

  if (!profileIsValid) {
    missingRequirements.push({
      code: "PROFILE_INVALID",
      message: "Completează universitatea și anul de studiu cu valori valide.",
      href: "/cont/profil-student",
    });
  }

  if (activeTreatments === 0) {
    missingRequirements.push({
      code: "TREATMENT_MISSING",
      message: "Activează cel puțin un tratament disponibil în catalog.",
      href: "/cont/tratamente",
    });
  }

  if (activeLocations === 0) {
    missingRequirements.push({
      code: "LOCATION_MISSING",
      message: "Activează cel puțin o locație dintr-un oraș disponibil.",
      href: "/cont/locatii",
    });
  }

  if (activeSupervisors === 0) {
    missingRequirements.push({
      code: "SUPERVISOR_MISSING",
      message: "Adaugă și activează cel puțin un profesor supervizor.",
      href: "/cont/supervizori",
    });
  }

  if (
    activeTreatments > 0 &&
    activeLocations > 0 &&
    activeSupervisors > 0 &&
    completeOffers === 0
  ) {
    missingRequirements.push({
      code: "COMPLETE_OFFER_MISSING",
      message:
        "Asociază unui tratament activ o locație și un profesor disponibili.",
      href: "/cont/tratamente",
    });
  }

  const canPublish = missingRequirements.length === 0;

  return {
    profileId: profile.id,
    userName: profile.user.name,
    isPublished: profile.isPublished,
    publishedAt: profile.publishedAt,
    publicSlug: profile.publicSlug,
    canPublish,
    isPubliclyVisible:
      profile.isPublished && canPublish && profile.publicSlug !== null,
    missingRequirements,
  };
}

export async function getStudentPublicationReadiness(userId: string) {
  return prisma.$transaction((transaction) =>
    evaluateStudentPublication(transaction, userId),
  );
}
