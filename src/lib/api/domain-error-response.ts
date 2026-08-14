import { AppointmentDomainError } from "@/lib/appointments/appointment-service";
import { AvailabilityDomainError } from "@/lib/availability/availability-service";

export function domainErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AppointmentDomainError || error instanceof AvailabilityDomainError) {
    const conflictCodes = new Set([
      "SLOT_UNAVAILABLE",
      "PATIENT_TIME_CONFLICT",
      "REVIEW_ALREADY_SUBMITTED",
      "REVIEW_REQUIRED",
      "STALE_VERSION",
      "CONFLICT",
    ]);
    const notFoundCodes = new Set([
      "SLOT_NOT_FOUND",
      "SERIES_NOT_FOUND",
      "APPOINTMENT_NOT_FOUND",
      "ASSOCIATION_NOT_FOUND",
    ]);
    const status = notFoundCodes.has(error.code)
      ? 404
      : conflictCodes.has(error.code)
        ? 409
        : 400;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
