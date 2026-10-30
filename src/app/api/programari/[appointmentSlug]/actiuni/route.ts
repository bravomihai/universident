import { readJsonRequest } from "@/lib/api/request-body";
import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { domainErrorResponse } from "@/lib/api/domain-error-response";
import { toAppointmentApiDto } from "@/lib/appointments/appointment-api-dto";
import { parseAppointmentActionInput } from "@/lib/appointments/appointment-input";
import { actOnAppointment } from "@/lib/appointments/appointment-service";

type Context = { params: Promise<{ appointmentSlug: string }> };

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true, roles: [UserRole.PATIENT, UserRole.STUDENT] });
  if (!authorization.ok) return authorization.response;
  const bodyResult = await readJsonRequest(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.data;
  const parsed = parseAppointmentActionInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { appointmentSlug } = await context.params;
    const appointment = await actOnAppointment(appointmentSlug, authorization.user, parsed.data);
    return Response.json({ appointment: toAppointmentApiDto(appointment) });
  } catch (error) {
    return domainErrorResponse(error, "Programarea nu a putut fi actualizată.");
  }
}
