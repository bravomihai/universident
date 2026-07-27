import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";

export async function requireStudentPageSession() {
  const session = await requireAccountPageSession();

  if (session.user.role !== UserRole.STUDENT) {
    redirect("/cont");
  }

  return session;
}
