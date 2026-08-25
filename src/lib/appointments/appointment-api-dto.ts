type AppointmentApiSource = {
  routeSlug: string;
  scheduledStartsAt: Date | string;
  scheduledEndsAt: Date | string;
  patientAgeAtAppointment: number;
  patientNote: string | null;
  patientNameSnapshot: string;
  studentNameSnapshot: string;
  treatmentNameSnapshot: string;
  locationNameSnapshot: string;
  locationAddressSnapshot: string;
  supervisorNameSnapshot: string;
  status: string;
  version: number;
  statusReason: string | null;
  isLateCancellation: boolean;
  patientProfile: {
    profileSlug: string;
    user: {
      name: string;
      reviewsReceived: ReadonlyArray<{ rating: number }>;
    };
  };
  studentProfile: {
    publicSlug: string | null;
    university: string;
    studyYear: number;
    user: {
      name: string;
      reviewsReceived: ReadonlyArray<{ rating: number }>;
    };
  };
  reviews: ReadonlyArray<{
    authorRole: string;
    submittedAt: Date | string;
    rating?: number;
    comment?: string | null;
    publishedAt?: Date | string | null;
  }>;
};

export function toAppointmentApiDto(appointment: AppointmentApiSource) {
  return {
    routeSlug: appointment.routeSlug,
    scheduledStartsAt: appointment.scheduledStartsAt,
    scheduledEndsAt: appointment.scheduledEndsAt,
    patientAgeAtAppointment: appointment.patientAgeAtAppointment,
    patientNote: appointment.patientNote,
    patientNameSnapshot: appointment.patientNameSnapshot,
    studentNameSnapshot: appointment.studentNameSnapshot,
    treatmentNameSnapshot: appointment.treatmentNameSnapshot,
    locationNameSnapshot: appointment.locationNameSnapshot,
    locationAddressSnapshot: appointment.locationAddressSnapshot,
    supervisorNameSnapshot: appointment.supervisorNameSnapshot,
    status: appointment.status,
    version: appointment.version,
    statusReason: appointment.statusReason,
    isLateCancellation: appointment.isLateCancellation,
    patientProfile: {
      profileSlug: appointment.patientProfile.profileSlug,
      user: {
        name: appointment.patientProfile.user.name,
        reviewsReceived: appointment.patientProfile.user.reviewsReceived,
      },
    },
    studentProfile: {
      publicSlug: appointment.studentProfile.publicSlug,
      university: appointment.studentProfile.university,
      studyYear: appointment.studentProfile.studyYear,
      user: {
        name: appointment.studentProfile.user.name,
        reviewsReceived: appointment.studentProfile.user.reviewsReceived,
      },
    },
    reviews: appointment.reviews.map((review) => ({
      authorRole: review.authorRole,
      submittedAt: review.submittedAt,
      rating: review.rating,
      comment: review.comment,
      publishedAt: review.publishedAt,
    })),
  };
}
