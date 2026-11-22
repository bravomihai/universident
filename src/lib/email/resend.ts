import "server-only";

export const EMAIL_MAX_ATTEMPTS = 8;
export const EMAIL_MAX_RETRY_AGE_MS = 23 * 60 * 60_000;
export const EMAIL_LEASE_MS = 60_000;
export const EMAIL_OVERDUE_MS = 5 * 60_000;

export type EmailEnvelope = { to: string; from: string; idempotencyKey: string };
type EmailContent = { subject: string; text: string; html: string };

export function emailRetryDueAt(attempts: number, now: Date) {
  return new Date(now.getTime() + Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000));
}

export function getTransactionalEmailConfig() {
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "").origin;
  const from = process.env.EMAIL_FROM?.trim();
  if (!from || !process.env.RESEND_API_KEY?.trim()) throw new Error("EMAIL_NOT_CONFIGURED");
  return { origin, from };
}

export function escapeEmailHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export async function sendResendEmail({ idempotencyKey, from, to, ...content }: EmailEnvelope & EmailContent) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to, ...content }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");

  // A successful HTTP response already means the provider accepted the email.
  const result: { id?: unknown } | null = await response.json().catch(() => null);
  return typeof result?.id === "string" ? result.id : null;
}
