import { readJsonRequest } from "@/lib/api/request-body";
import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { domainErrorResponse } from "@/lib/api/domain-error-response";
import { parseCreateAppointmentInput } from "@/lib/appointments/appointment-input";
import { bookingUserRateLimiter } from "@/lib/appointments/booking-rate-limit";
import { createAppointmentRequest } from "@/lib/appointments/appointment-service";

type Context = { params: Promise<{ studentSlug: string }> };

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true, roles: [UserRole.PATIENT] });
  if (!authorization.ok) return authorization.response;
  const rateLimit = bookingUserRateLimiter.consume(authorization.user.id);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Ai trimis prea multe cereri. Așteaptă puțin și încearcă din nou.", code: "BOOKING_RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }
  const bodyResult = await readJsonRequest(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.data;
  const parsed = parseCreateAppointmentInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { studentSlug } = await context.params;
    const appointment = await createAppointmentRequest(authorization.user, studentSlug, parsed.data);
    return Response.json(
      { appointment: { routeSlug: appointment.routeSlug } },
      { status: 201 },
    );
  } catch (error) {
    return domainErrorResponse(error, "Cererea de programare nu a putut fi trimisă.");
  }
}
