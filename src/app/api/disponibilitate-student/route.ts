import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { domainErrorResponse } from "@/lib/api/domain-error-response";
import { parseCreateAvailabilityInput } from "@/lib/availability/availability-input";
import {
  createAvailability,
  getStudentAvailabilityCatalog,
  listStudentAvailability,
} from "@/lib/availability/availability-service";
import { prisma } from "@/lib/prisma";

async function studentProfileId(userId: string) {
  return prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
}

export async function GET(request: Request) {
  const authorization = await authorizeAccountRequest(request, { roles: [UserRole.STUDENT] });
  if (!authorization.ok) return authorization.response;
  const student = await studentProfileId(authorization.user.id);
  if (!student) return Response.json({ error: "Completează profilul profesional." }, { status: 404 });
  const url = new URL(request.url);
  const now = new Date();
  const from = new Date(url.searchParams.get("from") ?? now.toISOString());
  const to = new Date(url.searchParams.get("to") ?? new Date(now.getTime() + 180 * 86_400_000).toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json({ error: "Intervalul calendarului nu este valid." }, { status: 400 });
  }
  try {
    const [slots, catalog] = await Promise.all([
      listStudentAvailability(student.id, from, to, now),
      getStudentAvailabilityCatalog(student.id),
    ]);
    return Response.json({ slots, catalog });
  } catch (error) {
    return domainErrorResponse(error, "Calendarul nu a putut fi încărcat.");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true, roles: [UserRole.STUDENT] });
  if (!authorization.ok) return authorization.response;
  const student = await studentProfileId(authorization.user.id);
  if (!student) return Response.json({ error: "Completează profilul profesional." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parseCreateAvailabilityInput(body, new Date());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const availability = await createAvailability(student.id, parsed.data);
    return Response.json({ availability }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error, "Disponibilitatea nu a putut fi creată.");
  }
}
