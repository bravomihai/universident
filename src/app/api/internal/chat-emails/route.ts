import { timingSafeEqual } from "node:crypto";
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
    return Response.json(await processChatEmails(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Procesarea notificărilor nu este disponibilă." }, { status: 503 });
  }
}
