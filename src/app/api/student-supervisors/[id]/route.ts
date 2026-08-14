import { prisma } from "@/lib/prisma";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";
import { studentSupervisorSelect } from "@/lib/student-supervisors/student-supervisor-data";
import { parseUpdateStudentSupervisorInput } from "@/lib/student-supervisors/student-supervisor-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";

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
  const existing = await prisma.studentSupervisor.findFirst({ where: { id, studentProfileId: auth.studentProfileId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Profesorul nu a fost găsit." }, { status: 404 });
  const futureUse = await prisma.studentAvailabilitySlotOffering.count({ where: { supervisorId: id, removedAt: null, slot: { status: "ACTIVE", startsAt: { gt: new Date() } } } });
  if (futureUse) return Response.json({ error: "Elimină mai întâi aparițiile viitoare supervizate de acest profesor." }, { status: 409 });
  const archivedAt = new Date(); await prisma.studentSupervisor.update({ where: { id }, data: { deletedAt: archivedAt } });
  return Response.json({ archivedSupervisorId: id, archivedAt });
}
