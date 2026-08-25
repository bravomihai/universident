import { AppointmentDomainError } from "@/lib/appointments/appointment-service";
import { AvailabilityDomainError } from "@/lib/availability/availability-service";
import { SchedulingTemporarilyUnavailableError } from "@/lib/scheduling/transaction";

export function domainErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AppointmentDomainError || error instanceof AvailabilityDomainError) {
    const conflictCodes = new Set([
      "SLOT_UNAVAILABLE",
      "PATIENT_TIME_CONFLICT",
      "REVIEW_ALREADY_SUBMITTED",
      "REVIEW_REQUIRED",
      "PENDING_LIMIT_REACHED",
      "IDEMPOTENCY_CONFLICT",
      "STALE_VERSION",
      "LIMIT_EXCEEDED",
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
  if (error instanceof SchedulingTemporarilyUnavailableError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: 503, headers: { "Retry-After": "1" } },
    );
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
