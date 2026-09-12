import { authorizeChat, chatJson } from "@/lib/chat/http";
import { chatErrorResponse } from "@/lib/chat/errors";
import { unreadChatCount } from "@/lib/chat/service";

export async function GET(request: Request) {
  const auth = await authorizeChat(request);
  if (!auth.ok) return auth.response;
  try { return chatJson({ count: await unreadChatCount(auth.user) }); }
  catch (error) { return chatErrorResponse(error); }
}
