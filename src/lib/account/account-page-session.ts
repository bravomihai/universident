import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function requireAccountPageSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/autentificare");
  }

  if (!session.user.emailVerified) {
    redirect("/verifica-email");
  }

  return session;
}
