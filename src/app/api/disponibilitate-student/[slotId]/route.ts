import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { domainErrorResponse } from "@/lib/api/domain-error-response";
import {
  parseCancelAvailabilityInput,
  parseUpdateAvailabilityInput,
} from "@/lib/availability/availability-input";
import { cancelAvailability, updateAvailability } from "@/lib/availability/availability-service";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ slotId: string }> };

async function authorize(request: Request) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true, roles: [UserRole.STUDENT] });
  if (!authorization.ok) return authorization;
  const student = await prisma.studentProfile.findUnique({ where: { userId: authorization.user.id }, select: { id: true } });
  if (!student) return { ok: false as const, response: Response.json({ error: "Completează profilul profesional." }, { status: 404 }) };
  return { ok: true as const, user: authorization.user, studentProfileId: student.id };
}

export async function PATCH(request: Request, context: Context) {
  const authorization = await authorize(request);
  if (!authorization.ok) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parseUpdateAvailabilityInput(body, new Date());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { slotId } = await context.params;
    const availability = await updateAvailability(authorization.studentProfileId, authorization.user.id, slotId, parsed.data);
    return Response.json({ availability });
  } catch (error) {
    return domainErrorResponse(error, "Disponibilitatea nu a putut fi mutată.");
  }
}

export async function DELETE(request: Request, context: Context) {
  const authorization = await authorize(request);
  if (!authorization.ok) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parseCancelAvailabilityInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { slotId } = await context.params;
    const result = await cancelAvailability(authorization.studentProfileId, authorization.user.id, slotId, parsed.data);
    return Response.json(result);
  } catch (error) {
    return domainErrorResponse(error, "Disponibilitatea nu a putut fi anulată.");
  }
}
