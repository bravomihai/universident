import { prisma } from "@/lib/prisma";
import { studentLocationSelect } from "@/lib/student-locations/student-location-data";
import { parseUpdateStudentLocationInput } from "@/lib/student-locations/student-location-input";
import { authorizeStudentLocationRequest } from "@/lib/student-locations/student-location-request";
import {
  archiveStudentSchedulingResource,
  ResourceArchiveDomainError,
} from "@/lib/availability/resource-archive-service";
import { SchedulingTemporarilyUnavailableError } from "@/lib/scheduling/transaction";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeStudentLocationRequest(request, { verifyOrigin: true });
  if (!auth.ok) return auth.response;
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parseUpdateStudentLocationInput(body); if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  if (parsed.data.cityId) {
    const city = await prisma.city.findFirst({ where: { id: parsed.data.cityId, isActive: true } });
    if (!city) return Response.json({ error: "Orașul selectat nu este disponibil." }, { status: 400 });
  }
  const { id } = await context.params;
  const existing = await prisma.studentLocation.findFirst({ where: { id, studentProfileId: auth.studentProfileId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Locația nu a fost găsită." }, { status: 404 });
  const location = await prisma.studentLocation.update({ where: { id }, data: parsed.data, select: studentLocationSelect });
  return Response.json({ location });
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeStudentLocationRequest(request, { verifyOrigin: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const result = await archiveStudentSchedulingResource(
      "location",
      auth.studentProfileId,
      id,
    );
    return Response.json({ archivedLocationId: id, archivedAt: result.archivedAt });
  } catch (error) {
    if (error instanceof ResourceArchiveDomainError) {
      return Response.json(
        { error: error.code === "NOT_FOUND" ? "Locația nu a fost găsită." : error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    if (error instanceof SchedulingTemporarilyUnavailableError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: 503, headers: { "Retry-After": "1" } },
      );
    }
    throw error;
  }
}
