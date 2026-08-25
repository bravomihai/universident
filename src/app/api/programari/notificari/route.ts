import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { parseAppointmentNotificationAcknowledgementInput } from "@/lib/appointments/appointment-input";
import { acknowledgeAppointmentNotifications } from "@/lib/appointments/appointment-service";

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.PATIENT, UserRole.STUDENT],
  });
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Datele trimise nu sunt valide." },
      { status: 400 },
    );
  }
  const parsed = parseAppointmentNotificationAcknowledgementInput(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const result = await acknowledgeAppointmentNotifications(
    authorization.user.id,
    parsed.data.notificationIds,
  );
  return Response.json({ acknowledged: result.count });
}
