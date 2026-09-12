export const CHAT_GRACE_MS = 7 * 24 * 60 * 60_000;
export const CHAT_MAX_LENGTH = 2_000;
export const EMAIL_DELAY_MS = 3 * 60_000;
export const EMAIL_COOLDOWN_MS = 15 * 60_000;

export type ChatAppointmentState = {
  status: string;
  confirmedAt: Date | string | null;
  statusChangedAt: Date | string;
};

export function chatState(appointment: ChatAppointmentState, now = new Date()) {
  const available = appointment.confirmedAt !== null;
  const past = available && appointment.status !== "CONFIRMED";
  const closesAt = past
    ? new Date(new Date(appointment.statusChangedAt).getTime() + CHAT_GRACE_MS)
    : null;
  return {
    available,
    past,
    canSend: available && (!closesAt || now.getTime() < closesAt.getTime()),
    closesAt: closesAt?.toISOString() ?? null,
  };
}

export function parseChatMessage(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.text !== "string" || typeof value.clientId !== "string") return null;
  const text = value.text.trim();
  if (!text || text.length > CHAT_MAX_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return null;
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(value.clientId)) return null;
  return { text, clientId: value.clientId };
}

export function nextEmailDueAt(now: Date, lastSentAt: Date | null) {
  return new Date(Math.max(now.getTime() + EMAIL_DELAY_MS, (lastSentAt?.getTime() ?? 0) + EMAIL_COOLDOWN_MS));
}

export function safeChatReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Only the inbox and a single encoded conversation slug are supported.
  if (!/^\/cont\/mesaje(?:\/[a-zA-Z0-9_-]+)?$/.test(value)) return null;
  return value;
}
