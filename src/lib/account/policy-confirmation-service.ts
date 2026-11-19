import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { accountPolicyForRole, currentPolicyWhere, policyConfirmations, type AccountPolicy } from "./policy-confirmations";

export async function hasConfirmedPolicy(userId: string, policy: AccountPolicy, db: Prisma.TransactionClient = prisma) {
  return Boolean(await db.user.findFirst({
    where: { id: userId, ...currentPolicyWhere(policy) },
    select: { id: true },
  }));
}

export async function missingAccountPolicy(user: { id: string; role: string }) {
  const policy = accountPolicyForRole(user.role);
  return policy && !await hasConfirmedPolicy(user.id, policy) ? policy : null;
}

export async function recordPolicyConfirmation(userId: string, policy: AccountPolicy) {
  const version = policyConfirmations[policy].version;
  if (await hasConfirmedPolicy(userId, policy)) return;
  await prisma.accountPolicyConfirmation.createMany({
    data: { userId, policy, version },
    skipDuplicates: true,
  });
}
