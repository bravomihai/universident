import { authorizeChat, chatJson, readChatJson } from "@/lib/chat/http";
import { chatErrorResponse } from "@/lib/chat/errors";
import { reportMedicalChatMessage } from "@/lib/chat/service";

export async function POST(request: Request, { params }: { params: Promise<{ conversationSlug: string }> }) {
  const auth = await authorizeChat(request, true);
  if (!auth.ok) return auth.response;
  try {
    const body = await readChatJson(request);
    const id = body && typeof body === "object" && "messageId" in body ? body.messageId : null;
    if (typeof id !== "string" || !/^[a-z0-9_-]{10,64}$/i.test(id)) {
      return chatJson({ error: "Mesajul indicat nu este valid." }, 400);
    }
    await reportMedicalChatMessage((await params).conversationSlug, auth.user, id);
    return chatJson({ reported: true });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
