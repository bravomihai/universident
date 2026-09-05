import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";

type PatientProfileViewer = {
  id: string;
  role: UserRole;
  emailVerified: boolean;
};

// Both the private profile page and its image use this same access boundary.
export function patientProfileAccessWhere(
  viewer: PatientProfileViewer,
): Prisma.PatientProfileWhereInput {
  if (viewer.emailVerified && viewer.id) {
    if (viewer.role === UserRole.PATIENT) {
      return { userId: viewer.id };
    }

    if (viewer.role === UserRole.STUDENT) {
      return {
        appointments: {
          some: { studentProfile: { userId: viewer.id } },
        },
      };
    }
  }

  return { id: { in: [] } };
}
