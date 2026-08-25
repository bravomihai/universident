import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { toAppointmentApiDto } from "@/lib/appointments/appointment-api-dto";
import { getAppointmentForUser } from "@/lib/appointments/appointment-service";

type Context = { params: Promise<{ appointmentSlug: string }> };

export async function GET(request: Request, context: Context) {
  const authorization = await authorizeAccountRequest(request, { roles: [UserRole.PATIENT, UserRole.STUDENT] });
  if (!authorization.ok) return authorization.response;
  const { appointmentSlug } = await context.params;
  const appointment = await getAppointmentForUser(appointmentSlug, authorization.user.id, authorization.user.role);
  if (!appointment) return Response.json({ error: "Programarea nu a fost găsită." }, { status: 404 });
  return Response.json({ appointment: toAppointmentApiDto(appointment) });
}
