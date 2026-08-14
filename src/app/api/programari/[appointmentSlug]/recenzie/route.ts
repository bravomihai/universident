import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { domainErrorResponse } from "@/lib/api/domain-error-response";
import { parseAppointmentReviewInput } from "@/lib/appointments/appointment-input";
import { reviewAppointment } from "@/lib/appointments/appointment-service";

type Context = { params: Promise<{ appointmentSlug: string }> };

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.PATIENT, UserRole.STUDENT],
  });
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 });
  }
  const parsed = parseAppointmentReviewInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const { appointmentSlug } = await context.params;
    const review = await reviewAppointment(
      appointmentSlug,
      authorization.user,
      parsed.data,
    );
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error, "Recenzia nu a putut fi trimisă.");
  }
}
