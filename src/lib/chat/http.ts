import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { ChatError } from "./errors";

export function authorizeChat(request: Request, mutation = false) {
  return authorizeAccountRequest(request, { roles: [UserRole.PATIENT, UserRole.STUDENT], verifyOrigin: mutation });
}

export async function readChatJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError("INVALID_INPUT", "Datele trimise nu sunt valide.");
  let length = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        throw new ChatError("INPUT_TOO_LARGE", "Mesajul este prea lung.", 413);
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError("INVALID_INPUT", "Datele trimise nu sunt valide.");
  } finally { reader.releaseLock(); }
}

export function chatJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
