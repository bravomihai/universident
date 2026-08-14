import { prisma } from "@/lib/prisma";
import { studentLocationSelect } from "@/lib/student-locations/student-location-data";
import { parseUpdateStudentLocationInput } from "@/lib/student-locations/student-location-input";
import { authorizeStudentLocationRequest } from "@/lib/student-locations/student-location-request";

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
  const existing = await prisma.studentLocation.findFirst({ where: { id, studentProfileId: auth.studentProfileId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Locația nu a fost găsită." }, { status: 404 });
  const futureUse = await prisma.studentAvailabilitySlot.count({ where: { studentLocationId: id, status: "ACTIVE", startsAt: { gt: new Date() } } });
  if (futureUse) return Response.json({ error: "Elimină mai întâi aparițiile viitoare de la această locație." }, { status: 409 });
  const archivedAt = new Date();
  await prisma.studentLocation.update({ where: { id }, data: { deletedAt: archivedAt } });
  return Response.json({ archivedLocationId: id, archivedAt });
}
