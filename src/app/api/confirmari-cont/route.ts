import { authorizeAccountRequest } from "@/lib/api/account-request";
import { readJsonRequest } from "@/lib/api/request-body";
import { recordPolicyConfirmation } from "@/lib/account/policy-confirmation-service";
import { policyFromConfirmation } from "@/lib/account/policy-confirmations";

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true });
  if (!authorization.ok) return authorization.response;

  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return parsed.response;

  const policy = policyFromConfirmation(authorization.user.role, parsed.data);
  if (!policy) {
    return Response.json({ error: "Bifează confirmarea pentru versiunea curentă a textului." }, { status: 400 });
  }

  await recordPolicyConfirmation(authorization.user.id, policy);
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
