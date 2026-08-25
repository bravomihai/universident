import { prisma } from "@/lib/prisma";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";
import { studentSupervisorSelect } from "@/lib/student-supervisors/student-supervisor-data";
import { parseUpdateStudentSupervisorInput } from "@/lib/student-supervisors/student-supervisor-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";
import {
  archiveStudentSchedulingResource,
  ResourceArchiveDomainError,
} from "@/lib/availability/resource-archive-service";
import { SchedulingTemporarilyUnavailableError } from "@/lib/scheduling/transaction";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeStudentTreatmentRequest(request, { verifyOrigin: true }); if (!auth.ok) return auth.response;
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parseUpdateStudentSupervisorInput(body); if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { id } = await context.params;
  const existing = await prisma.studentSupervisor.findFirst({ where: { id, studentProfileId: auth.studentProfileId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Profesorul nu a fost găsit." }, { status: 404 });
  const supervisor = await prisma.studentSupervisor.update({ where: { id }, data: parsed.data, select: studentSupervisorSelect });
  return Response.json({ supervisor });
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeStudentTreatmentRequest(request, { verifyOrigin: true }); if (!auth.ok) return auth.response;
  const parsed = await parseEmptyJsonRequestBody(request); if (!parsed.ok) return parsed.response;
  const { id } = await context.params;
  try {
    const result = await archiveStudentSchedulingResource(
      "supervisor",
      auth.studentProfileId,
      id,
    );
    return Response.json({ archivedSupervisorId: id, archivedAt: result.archivedAt });
  } catch (error) {
    if (error instanceof ResourceArchiveDomainError) {
      return Response.json(
        { error: error.code === "NOT_FOUND" ? "Profesorul nu a fost găsit." : error.message },
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
