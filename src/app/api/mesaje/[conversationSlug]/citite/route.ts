import { authorizeChat, chatJson, readChatJson } from "@/lib/chat/http";
import { ChatError, chatErrorResponse } from "@/lib/chat/errors";
import { acknowledgeChatMessages } from "@/lib/chat/service";

export async function POST(request: Request, context: { params: Promise<{ conversationSlug: string }> }) {
  const auth = await authorizeChat(request, true);
  if (!auth.ok) return auth.response;
  try {
    const body = await readChatJson(request) as { ids?: unknown } | null;
    if (!body || !Array.isArray(body.ids) || body.ids.length > 100 || !body.ids.every((id) => typeof id === "string" && id.length <= 64)) throw new ChatError("INVALID_INPUT", "Datele trimise nu sunt valide.");
    const { conversationSlug } = await context.params;
    await acknowledgeChatMessages(conversationSlug, auth.user, body.ids);
    return chatJson({ ok: true });
  } catch (error) { return chatErrorResponse(error); }
}
