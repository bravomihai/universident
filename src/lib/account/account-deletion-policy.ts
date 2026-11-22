import { createHash } from "node:crypto";

export const deletedAccountName = "Cont șters";
export const accountDeletionLinkLifetimeMs = 60 * 60_000;
export const accountDeletionReason = "Contul unuia dintre participanți a fost șters.";

export function accountDeletionDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function accountDeletionTransition(
  status: string,
  startsAt: Date,
  pendingExpiresAt: Date | null,
  role: "PATIENT" | "STUDENT",
  now: Date,
) {
  if (status === "PENDING") {
    if (startsAt <= now || (pendingExpiresAt && pendingExpiresAt <= now)) {
      return { status: "EXPIRED", expiredAt: now } as const;
    }
    return role === "STUDENT"
      ? { status: "REJECTED", rejectedAt: now } as const
      : { status: "CANCELLED_BY_PATIENT", cancelledAt: now } as const;
  }
  if (status !== "CONFIRMED") return null;
  // Keep the interval occupied until its scheduled end. The deletion marker
  // archives the appointment and suppresses outcome and review actions.
  if (startsAt <= now) return { status: "CONFIRMED" } as const;
  return {
    status: role === "STUDENT" ? "CANCELLED_BY_STUDENT" : "CANCELLED_BY_PATIENT",
    cancelledAt: now,
    isLateCancellation: role === "PATIENT" && startsAt.getTime() - now.getTime() < 2 * 60 * 60_000,
  } as const;
}
