import { authorizeChat, chatJson } from "@/lib/chat/http";
import { chatErrorResponse } from "@/lib/chat/errors";
import { listChatConversations } from "@/lib/chat/service";

export async function GET(request: Request) {
  const auth = await authorizeChat(request);
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  try { return chatJson(await listChatConversations(auth.user, params.get("trecute") === "1", params.get("cursor") ?? undefined)); }
  catch (error) { return chatErrorResponse(error); }
}
