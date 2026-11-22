import { timingSafeEqual } from "node:crypto";
import { processAppointmentEmails } from "@/lib/appointments/appointment-email-worker";
import { processChatEmails } from "@/lib/chat/email-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CHAT_WORKER_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(supplied);
  if (!secret || secret.length < 32 || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: "Acces nepermis." }, { status: 401 });
  }
  try {
    const [chat, appointments] = await Promise.allSettled([processChatEmails(), processAppointmentEmails()]);
    if (chat.status === "rejected" || appointments.status === "rejected") {
      throw new Error("EMAIL_PROCESSING_FAILED");
    }
    return Response.json({
      sent: chat.value.sent + appointments.value.sent,
      failed: chat.value.failed + appointments.value.failed,
      failedBatches: chat.value.failedBatches + appointments.value.failedBatches,
      overdueBatches: chat.value.overdueBatches + appointments.value.overdueBatches,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Procesarea notificărilor nu este disponibilă." }, { status: 503 });
  }
}
