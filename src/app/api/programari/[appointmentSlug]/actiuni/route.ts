import { readJsonRequest } from "@/lib/api/request-body";
import { missingAccountPolicy } from "@/lib/account/policy-confirmation-service";
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
  if (parsed.data.action === "CONFIRM" && authorization.user.role === UserRole.STUDENT && await missingAccountPolicy(authorization.user)) {
    return Response.json({ error: "Confirmă declarația privind profilul înainte de a accepta o programare.", code: "ACCOUNT_POLICY_REQUIRED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { appointmentSlug } = await context.params;
    const appointment = await actOnAppointment(appointmentSlug, authorization.user, parsed.data);
    return Response.json({ appointment: toAppointmentApiDto(appointment) });
  } catch (error) {
    return domainErrorResponse(error, "Programarea nu a putut fi actualizată.");
  }
}
