import { listPublicStudentAvailability } from "@/lib/availability/public-availability-service";

type Context = { params: Promise<{ studentSlug: string }> };

export async function GET(request: Request, context: Context) {
  const { studentSlug } = await context.params;
  const url = new URL(request.url);
  const now = new Date();
  const from = new Date(url.searchParams.get("from") ?? now.toISOString());
  const to = new Date(url.searchParams.get("to") ?? new Date(now.getTime() + 60 * 86_400_000).toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json({ error: "Intervalul nu este valid." }, { status: 400 });
  }
  const slots = await listPublicStudentAvailability(studentSlug, from, to);
  if (!slots) return Response.json({ error: "Profilul nu a fost găsit." }, { status: 404 });
  return Response.json({ slots });
}
