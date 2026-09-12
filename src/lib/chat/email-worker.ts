import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { lockMailbox } from "./service";
import { EMAIL_COOLDOWN_MS, EMAIL_DELAY_MS } from "./policy";

const MAX_RETRY_AGE_MS = 23 * 60 * 60_000;
export function emailRetryDueAt(attempts: number, now: Date) {
  return new Date(now.getTime() + Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000));
}

export type ChatEmailPayload = { to: string; from: string; url: string; idempotencyKey: string };
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
export function chatEmailContent(url: string) {
  return {
    subject: "Ai mesaje noi pe Universident",
    text: `Ai mesaje necitite într-o conversație pe Universident.\n\nDeschide conversația: ${url}\n\nPentru a răspunde, autentifică-te pe Universident.`,
    html: `<!doctype html><html lang="ro"><body style="font-family:Arial,sans-serif;background:#f4f4f5;color:#18181b;padding:24px"><div style="max-width:560px;margin:auto;background:white;border-radius:16px;padding:32px"><h1 style="font-size:24px">Ai mesaje noi</h1><p>Ai mesaje necitite într-o conversație pe Universident.</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#18181b;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Deschide conversația</a></p><p>Pentru a răspunde, autentifică-te pe Universident.</p></div></body></html>`,
  };
}

export async function deliverChatEmail(payload: ChatEmailPayload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": payload.idempotencyKey },
    body: JSON.stringify({ from: payload.from, to: payload.to, ...chatEmailContent(payload.url) }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
}

/** Aggregate operational status; never return recipients, URLs or message content. */
export async function getChatEmailQueueStatus(now = new Date()) {
  const [failedBatches, overdueBatches] = await Promise.all([
    prisma.chatEmailBatch.count({ where: { status: "FAILED" } }),
    prisma.chatEmailBatch.count({ where: {
      status: { in: ["PENDING", "SENDING"] },
      dueAt: { lt: new Date(now.getTime() - 5 * 60_000) },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    } }),
  ]);
  return { failedBatches, overdueBatches };
}

export async function processChatEmails(deliver = deliverChatEmail, now = new Date()) {
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "").origin;
  const from = process.env.EMAIL_FROM?.trim();
  if (!from || !process.env.RESEND_API_KEY?.trim()) throw new Error("EMAIL_NOT_CONFIGURED");
  const candidates = await prisma.chatEmailBatch.findMany({
    where: { status: { in: ["PENDING", "SENDING"] }, dueAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    orderBy: { dueAt: "asc" }, take: 5,
    select: { id: true, mailbox: { select: { id: true, appointmentId: true, recipientUserId: true } } },
  });
  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.$transaction(async (db) => {
      await lockMailbox(db, candidate.mailbox.appointmentId, candidate.mailbox.recipientUserId);
      const mailbox = await db.chatMailbox.findUniqueOrThrow({ where: { id: candidate.mailbox.id }, include: { recipient: { select: { email: true, emailVerified: true } }, appointment: { select: { chatSlug: true } } } });
      const sending = await db.chatEmailBatch.findFirst({ where: { mailboxId: mailbox.id, status: "SENDING" }, orderBy: { createdAt: "asc" } });
      const batch = sending ?? await db.chatEmailBatch.findUnique({ where: { id: candidate.id } });
      if (!batch || !["PENDING", "SENDING"].includes(batch.status) || batch.dueAt > now || (batch.leaseUntil && batch.leaseUntil > now)) return null;
      if (batch.firstAttemptAt && (now.getTime() - batch.firstAttemptAt.getTime() >= MAX_RETRY_AGE_MS || batch.attempts >= 8)) {
        await db.chatEmailBatch.update({ where: { id: batch.id }, data: { status: "FAILED", lastErrorCode: "RETRIES_EXHAUSTED", leaseUntil: null } });
        return null;
      }
      const unread = await db.chatMessage.findFirst({ where: { emailBatchId: batch.id, recipientUserId: mailbox.recipientUserId, readAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
      if (!unread || !mailbox.recipient.emailVerified || (batch.recipientEmail && batch.recipientEmail !== mailbox.recipient.email)) {
        await db.chatEmailBatch.update({ where: { id: batch.id }, data: { status: "SKIPPED", leaseUntil: null } });
        return null;
      }
      const eligibleAt = new Date(unread.createdAt.getTime() + EMAIL_DELAY_MS);
      if (eligibleAt > now) {
        await db.chatEmailBatch.update({ where: { id: batch.id }, data: { dueAt: eligibleAt } });
        return null;
      }
      if (!sending && mailbox.lastSentAt && mailbox.lastSentAt.getTime() + EMAIL_COOLDOWN_MS > now.getTime()) {
        await db.chatEmailBatch.update({ where: { id: batch.id }, data: { dueAt: new Date(mailbox.lastSentAt.getTime() + EMAIL_COOLDOWN_MS) } });
        return null;
      }
      return db.chatEmailBatch.update({ where: { id: batch.id }, data: {
        status: "SENDING", leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + 60_000), attempts: { increment: 1 },
        firstAttemptAt: batch.firstAttemptAt ?? now,
        recipientEmail: batch.recipientEmail ?? mailbox.recipient.email,
        fromEmail: batch.fromEmail ?? from,
        conversationUrl: batch.conversationUrl ?? `${origin}/cont/mesaje/${mailbox.appointment.chatSlug}`,
      } });
    });
    if (!claimed) continue;
    try {
      // Read receipts can arrive between the claim and dispatch.
      const unread = await prisma.chatMessage.findFirst({ where: { emailBatchId: claimed.id, readAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
      if (!unread) {
        await prisma.chatEmailBatch.updateMany({ where: { id: claimed.id, leaseToken: claimed.leaseToken }, data: { status: "SKIPPED", leaseUntil: null } });
        continue;
      }
      // A previously old message may have been read after the claim. Give the remaining
      // new messages their own three-minute window before contacting the provider.
      const eligibleAt = new Date(unread.createdAt.getTime() + EMAIL_DELAY_MS);
      if (eligibleAt > now) {
        await prisma.chatEmailBatch.updateMany({ where: { id: claimed.id, leaseToken: claimed.leaseToken }, data: { dueAt: eligibleAt, leaseUntil: null } });
        continue;
      }
      await deliver({ to: claimed.recipientEmail!, from: claimed.fromEmail!, url: claimed.conversationUrl!, idempotencyKey: `universident-chat/${claimed.id}` });
      const sentAt = new Date(Math.max(now.getTime(), Date.now()));
      await prisma.$transaction(async (db) => {
        await lockMailbox(db, candidate.mailbox.appointmentId, candidate.mailbox.recipientUserId);
        const updated = await db.chatEmailBatch.updateMany({ where: { id: claimed.id, status: "SENDING", leaseToken: claimed.leaseToken }, data: { status: "SENT", sentAt, leaseUntil: null, lastErrorCode: null } });
        if (updated.count) await db.chatMailbox.update({ where: { id: claimed.mailboxId }, data: { lastSentAt: sentAt } });
      });
      sent++;
    } catch {
      failed++;
      await prisma.chatEmailBatch.updateMany({ where: { id: claimed.id, status: "SENDING", leaseToken: claimed.leaseToken }, data: {
        status: claimed.attempts >= 8 ? "FAILED" : "SENDING", leaseUntil: null,
        dueAt: emailRetryDueAt(claimed.attempts, now), lastErrorCode: "DELIVERY_FAILED",
      } });
    }
  }
  // Only throttle metadata is removed. Conversation history is retained.
  await prisma.chatSendAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { sent, failed, ...await getChatEmailQueueStatus(now) };
}
