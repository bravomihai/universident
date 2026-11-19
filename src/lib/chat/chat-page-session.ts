import { notFound, redirect } from "next/navigation";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { hasConfirmedPolicy, missingAccountPolicy } from "@/lib/account/policy-confirmation-service";
import { chatPolicyForRole } from "@/lib/account/policy-confirmations";

export async function requireChatPageSession(returnTo: string) {
  const session = await requireAccountPageSession(returnTo);
  const policy = chatPolicyForRole(session.user.role);
  if (!policy) notFound();

  if (await missingAccountPolicy(session.user) || !await hasConfirmedPolicy(session.user.id, policy)) {
    redirect("/confirma-reguli?next=" + encodeURIComponent(returnTo));
  }
  return session;
}
