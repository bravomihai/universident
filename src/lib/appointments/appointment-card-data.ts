import { patientProfileImageUrl } from "@/lib/patient/patient-profile-image";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";

type ImageReference = { id: string; updatedAt: Date } | null;
type Rating = { rating: number };

export type AppointmentCardSource = {
  routeSlug: string;
  version: number;
  status: string;
  scheduledStartsAt: Date | string;
  scheduledEndsAt: Date | string;
  patientNameSnapshot: string;
  studentNameSnapshot: string;
  patientAgeAtAppointment: number;
  treatmentNameSnapshot: string;
  locationNameSnapshot: string;
  locationAddressSnapshot: string;
  supervisorNameSnapshot: string;
  patientNote: string | null;
  statusReason: string | null;
  patientProfile: {
    profileSlug: string;
    profileImage: ImageReference;
    user: { reviewsReceived: Rating[] };
  };
  studentProfile: {
    publicSlug: string | null;
    isPublished: boolean;
    university: string;
    studyYear: number;
    profileImage: ImageReference;
    user: { role: string; emailVerified: boolean; reviewsReceived: Rating[] };
  };
  reviews: Array<{
    authorRole: string;
    rating?: number;
    comment?: string | null;
    publishedAt?: Date | string | null;
  }>;
};

// Only call for appointments already authorized by the private service. This
// is presentation data, not a replacement for profile/image route permissions.
export function appointmentCounterpart(appointment: AppointmentCardSource, role: "PATIENT" | "STUDENT") {
  const student = appointment.studentProfile;
  const patient = appointment.patientProfile;
  const publicStudent = Boolean(student.publicSlug && student.isPublished && student.university.trim() &&
    student.studyYear >= 1 && student.studyYear <= 6 && student.user.role === "STUDENT" && student.user.emailVerified);
  const ratings = role === "PATIENT" ? student.user.reviewsReceived : patient.user.reviewsReceived;
  return {
    label: role === "PATIENT" ? "Student" : "Pacient",
    name: role === "PATIENT" ? appointment.studentNameSnapshot : appointment.patientNameSnapshot,
    subtitle: role === "PATIENT"
      ? [student.university, student.studyYear ? `Anul ${student.studyYear}` : null].filter(Boolean).join(" · ")
      : `${appointment.patientAgeAtAppointment} ani la programare`,
    href: role === "PATIENT"
      ? publicStudent ? `/studenti/${encodeURIComponent(student.publicSlug!)}` : null
      : `/pacienti/${encodeURIComponent(patient.profileSlug)}`,
    imageUrl: role === "PATIENT"
      ? publicStudent ? studentProfileImageUrl(student.profileImage) : null
      : patientProfileImageUrl(patient.profileImage),
    summary: {
      averageRating: ratings.length ? ratings.reduce((sum, review) => sum + review.rating, 0) / ratings.length : null,
      reviewCount: ratings.length,
    },
  };
}

export type AppointmentCounterpart = ReturnType<typeof appointmentCounterpart>;
