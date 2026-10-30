import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { readRequestBytes, RequestBodyTooLargeError } from "@/lib/api/request-body";
import { ChatError } from "./errors";

export function authorizeChat(request: Request, mutation = false) {
  return authorizeAccountRequest(request, { roles: [UserRole.PATIENT, UserRole.STUDENT], verifyOrigin: mutation });
}

export async function readChatJson(request: Request): Promise<unknown> {
  try {
    const body = await readRequestBytes(request, 16_384);
    return JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw new ChatError("INPUT_TOO_LARGE", "Mesajul este prea lung.", 413);
    }
    throw new ChatError("INVALID_INPUT", "Datele trimise nu sunt valide.");
  }
}

export function chatJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
