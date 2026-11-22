import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { readRequestBytes, RequestBodyTooLargeError } from "@/lib/api/request-body";
import { hasConfirmedPolicy, missingAccountPolicy } from "@/lib/account/policy-confirmation-service";
import { chatPolicyForRole } from "@/lib/account/policy-confirmations";
import { ChatError } from "./errors";

export async function authorizeChat(request: Request, mutation = false) {
  const auth = await authorizeAccountRequest(request, { roles: [UserRole.PATIENT, UserRole.STUDENT], verifyOrigin: mutation });
  if (!auth.ok) return auth;

  const policy = chatPolicyForRole(auth.user.role);
  if (!policy || await missingAccountPolicy(auth.user) || !await hasConfirmedPolicy(auth.user.id, policy)) {
    return { ok: false as const, response: chatJson({
      code: "CHAT_POLICY_REQUIRED",
      error: "Confirmă regulile aplicabile înainte de a folosi chatul.",
      href: "/confirma-reguli?next=%2Fcont%2Fmesaje",
    }, 403) };
  }
  return auth;
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
