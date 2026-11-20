import { recordPolicyConfirmation } from "@/lib/account/policy-confirmation-service";
import { policyFromConfirmation } from "@/lib/account/policy-confirmations";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { readJsonRequest, readRequestBytes, requestBodyErrorResponse } from "@/lib/api/request-body";
import { safeChatReturnTo } from "@/lib/chat/policy";

const confirmationHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true });
  if (!authorization.ok) return authorization.response;

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  let data: unknown;
  let returnPath: string | null = null;

  if (contentType === "application/x-www-form-urlencoded") {
    let form: URLSearchParams;
    try {
      const bytes = await readRequestBytes(request, 4096);
      form = new URLSearchParams(new TextDecoder().decode(bytes));
    } catch (error) {
      return requestBodyErrorResponse(error);
    }

    const version = form.get("confirmedPolicy");
    data = { confirmed: version !== null, version };
    const requestedNext = form.get("next");
    const next = requestedNext === "acasa" ? requestedNext : safeChatReturnTo(requestedNext);
    returnPath = next ? `/confirma-reguli?${new URLSearchParams({ next })}` : "/confirma-reguli";
  } else {
    const parsed = await readJsonRequest(request);
    if (!parsed.ok) return parsed.response;
    data = parsed.data;
  }

  const policy = policyFromConfirmation(authorization.user.role, data);
  if (!policy) {
    return Response.json({ error: "Bifează confirmarea pentru versiunea curentă a textului." }, { status: 400, headers: confirmationHeaders });
  }

  await recordPolicyConfirmation(authorization.user.id, policy);

  if (returnPath) {
    return new Response(null, { status: 303, headers: { ...confirmationHeaders, Location: returnPath } });
  }
  return new Response(null, { status: 204, headers: confirmationHeaders });
}
