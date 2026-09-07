import { AppointmentStatus } from "@/generated/prisma/enums";
import type {
  PublicStudentProfileDto,
  PublicStudentTreatmentDto,
} from "@/lib/public-students/public-student-service";
import type { ProfileReviewData } from "@/lib/reviews/profile-review-service";
import {
  studentProfileImageUrl,
  type StudentProfileImageReference,
} from "@/lib/student-profile/student-profile-image";

type Profile = {
  user: { name: string };
  publicSlug: string | null;
  university: string;
  studyYear: number;
  bio: string | null;
  profileImage: StudentProfileImageReference | null;
  // The server query supplies only the ten most recent confirmed appointments.
  appointments: readonly { status: AppointmentStatus }[];
};

export function createPublicStudentProfile(
  profile: Profile,
  treatments: PublicStudentTreatmentDto[],
  reviewData: ProfileReviewData,
): PublicStudentProfileDto | null {
  if (!profile.publicSlug) return null;

  // Expose only the aggregate, never appointment records or patient details.
  return {
    name: profile.user.name,
    imageUrl: studentProfileImageUrl(profile.profileImage),
    publicSlug: profile.publicSlug,
    university: profile.university,
    studyYear: profile.studyYear,
    bio: profile.bio,
    treatments,
    reviewData,
    cancellationsLast10: profile.appointments.filter(
      (appointment) => appointment.status === AppointmentStatus.CANCELLED_BY_STUDENT,
    ).length,
  };
}
