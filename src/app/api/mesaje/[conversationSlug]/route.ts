import { authorizeChat, chatJson, readChatJson } from "@/lib/chat/http";
import { ChatError, chatErrorResponse } from "@/lib/chat/errors";
import { getChatPage, sendChatMessage } from "@/lib/chat/service";
import { parseChatMessage } from "@/lib/chat/policy";

type Context = { params: Promise<{ conversationSlug: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await authorizeChat(request);
  if (!auth.ok) return auth.response;
  try {
    const { conversationSlug } = await context.params;
    return chatJson(await getChatPage(conversationSlug, auth.user, new URL(request.url).searchParams.get("cursor") ?? undefined));
  } catch (error) { return chatErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  const auth = await authorizeChat(request, true);
  if (!auth.ok) return auth.response;
  try {
    const input = parseChatMessage(await readChatJson(request));
    if (!input) throw new ChatError("INVALID_INPUT", "Scrie un mesaj de maximum 2.000 de caractere.");
    const { conversationSlug } = await context.params;
    return chatJson({ message: await sendChatMessage(conversationSlug, auth.user, input) }, 201);
  } catch (error) { return chatErrorResponse(error); }
}
