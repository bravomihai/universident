import { publicBookingWindowEnd } from "@/lib/availability/public-booking-window";
import { listPublicStudentAvailability } from "@/lib/availability/public-availability-service";

type Context = { params: Promise<{ studentSlug: string }> };

export async function GET(request: Request, context: Context) {
  const { studentSlug } = await context.params;
  const url = new URL(request.url);
  const now = new Date();
  const bookingWindowEnd = publicBookingWindowEnd(now);
  const from = new Date(url.searchParams.get("from") ?? now.toISOString());
  const to = new Date(url.searchParams.get("to") ?? publicBookingWindowEnd(now).toISOString());
  const treatmentSlug = url.searchParams.get("tratament")?.trim() ?? "";
  const citySlug = url.searchParams.get("oras")?.trim() ?? "";
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= from ||
    to > bookingWindowEnd ||
    from >= bookingWindowEnd
  ) {
    return Response.json({ error: "Intervalul nu este valid." }, { status: 400 });
  }
  if (!treatmentSlug || !citySlug) {
    return Response.json({ error: "Tratamentul și orașul sunt obligatorii." }, { status: 400 });
  }
  const slots = await listPublicStudentAvailability(
    studentSlug,
    treatmentSlug,
    citySlug,
    from,
    to,
  );
  if (!slots) return Response.json({ error: "Profilul nu a fost găsit." }, { status: 404 });
  return Response.json({ slots });
}
