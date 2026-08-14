import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";

export async function GET(request: Request) {
  const authorization = await authorizeAccountRequest(request, { roles: [UserRole.PATIENT, UserRole.STUDENT] });
  if (!authorization.ok) return authorization.response;
  const result = await listAppointmentsForUser(authorization.user.id, authorization.user.role);
  return Response.json(result);
}
