import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";

export async function requireStudentPageSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/autentificare");
  }

  if (session.user.role !== UserRole.STUDENT) {
    redirect("/cont");
  }

  return session;
}
