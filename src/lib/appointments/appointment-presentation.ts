const directlyArchivedStatuses = new Set([
  "REJECTED",
  "SUPERSEDED",
  "EXPIRED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_STUDENT",
]);

type PresentationAppointment = {
  status: string;
  scheduledStartsAt: Date | string;
  scheduledEndsAt: Date | string;
  reviews: ReadonlyArray<{ authorRole: string }>;
};

export function hasAppointmentReview(
  appointment: PresentationAppointment,
  role: "PATIENT" | "STUDENT",
) {
  return appointment.reviews.some((review) => review.authorRole === role);
}

export function appointmentReviewIsAllowed(
  status: string,
  role: "PATIENT" | "STUDENT",
) {
  return status === "COMPLETED" || (status === "NO_SHOW" && role === "STUDENT");
}

export function appointmentNeedsAttention(
  appointment: PresentationAppointment,
  role: "PATIENT" | "STUDENT",
  now = new Date(),
) {
  if (
    role === "STUDENT" &&
    appointment.status === "CONFIRMED" &&
    new Date(appointment.scheduledEndsAt) <= now
  ) {
    return true;
  }
  return (
    appointmentReviewIsAllowed(appointment.status, role) &&
    !hasAppointmentReview(appointment, role)
  );
}

export function appointmentIsArchived(
  appointment: PresentationAppointment,
  role: "PATIENT" | "STUDENT",
) {
  if (directlyArchivedStatuses.has(appointment.status)) return true;
  if (appointment.status === "NO_SHOW" && role === "PATIENT") return true;
  if (appointment.status === "COMPLETED" || appointment.status === "NO_SHOW") {
    return hasAppointmentReview(appointment, role);
  }
  return false;
}

export function orderAppointmentsForRole<T extends PresentationAppointment>(
  appointments: T[],
  role: "PATIENT" | "STUDENT",
  now = new Date(),
) {
  return [...appointments].sort((first, second) => {
    const attentionDifference = Number(appointmentNeedsAttention(second, role, now)) -
      Number(appointmentNeedsAttention(first, role, now));
    if (attentionDifference !== 0) return attentionDifference;
    const archiveDifference = Number(appointmentIsArchived(first, role)) -
      Number(appointmentIsArchived(second, role));
    if (archiveDifference !== 0) return archiveDifference;
    return new Date(second.scheduledStartsAt).getTime() - new Date(first.scheduledStartsAt).getTime();
  });
}
