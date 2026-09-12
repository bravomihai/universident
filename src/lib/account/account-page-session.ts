import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeChatReturnTo } from "@/lib/chat/policy";
import { auth } from "@/lib/auth";

export async function requireAccountPageSession(returnTo?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    const next = safeChatReturnTo(returnTo);
    redirect(next ? `/autentificare?next=${encodeURIComponent(next)}` : "/autentificare");
  }

  if (!session.user.emailVerified) {
    const next = safeChatReturnTo(returnTo);
    redirect(next ? `/verifica-email?next=${encodeURIComponent(next)}` : "/verifica-email");
  }

  return session;
}
