import "server-only";

import { randomUUID } from "node:crypto";
import {
  EMAIL_LEASE_MS,
  EMAIL_MAX_ATTEMPTS,
  EMAIL_MAX_RETRY_AGE_MS,
  EMAIL_OVERDUE_MS,
  emailRetryDueAt,
  escapeEmailHtml,
  getTransactionalEmailConfig,
  sendResendEmail,
  type EmailEnvelope,
} from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { lockMailbox } from "./service";
import { EMAIL_COOLDOWN_MS, EMAIL_DELAY_MS } from "./policy";

type ChatEmailPayload = EmailEnvelope & { url: string };

export function chatEmailContent(url: string) {
  return {
    subject: "Ai mesaje noi pe Universident",
    text: `Ai mesaje necitite într-o conversație pe Universident.\n\nDeschide conversația: ${url}\n\nPentru a răspunde, autentifică-te pe Universident.`,
    html: `<!doctype html><html lang="ro"><body style="font-family:Arial,sans-serif;background:#f4f4f5;color:#18181b;padding:24px"><div style="max-width:560px;margin:auto;background:white;border-radius:16px;padding:32px"><h1 style="font-size:24px">Ai mesaje noi</h1><p>Ai mesaje necitite într-o conversație pe Universident.</p><p style="margin:28px 0"><a href="${escapeEmailHtml(url)}" style="background:#18181b;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Deschide conversația</a></p><p>Pentru a răspunde, autentifică-te pe Universident.</p></div></body></html>`,
  };
}

export function deliverChatEmail({ url, ...envelope }: ChatEmailPayload) {
  return sendResendEmail({ ...envelope, ...chatEmailContent(url) });
}

/** Aggregate operational status; never return recipients, URLs or message content. */
export async function getChatEmailQueueStatus(now = new Date()) {
  const [failedBatches, overdueBatches] = await Promise.all([
    prisma.chatEmailBatch.count({ where: { status: "FAILED" } }),
    prisma.chatEmailBatch.count({ where: {
      status: { in: ["PENDING", "SENDING"] },
      dueAt: { lt: new Date(now.getTime() - EMAIL_OVERDUE_MS) },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    } }),
  ]);
  return { failedBatches, overdueBatches };
}

export async function processChatEmails(
  deliver: (payload: ChatEmailPayload) => Promise<string | null | void> = deliverChatEmail,
  now = new Date(),
) {
  const { origin, from } = getTransactionalEmailConfig();
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
      const mailbox = await db.chatMailbox.findUnique({ where: { id: candidate.mailbox.id }, include: { recipient: { select: { email: true, emailVerified: true } }, appointment: { select: { chatSlug: true, participantDeleted: true } } } });
      if (!mailbox || mailbox.appointment.participantDeleted) return null;
      const sending = await db.chatEmailBatch.findFirst({ where: { mailboxId: mailbox.id, status: "SENDING" }, orderBy: { createdAt: "asc" } });
      const batch = sending ?? await db.chatEmailBatch.findUnique({ where: { id: candidate.id } });
      if (!batch || !["PENDING", "SENDING"].includes(batch.status) || batch.dueAt > now || (batch.leaseUntil && batch.leaseUntil > now)) return null;
      if (batch.firstAttemptAt && (now.getTime() - batch.firstAttemptAt.getTime() >= EMAIL_MAX_RETRY_AGE_MS || batch.attempts >= EMAIL_MAX_ATTEMPTS)) {
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
        status: "SENDING", leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + EMAIL_LEASE_MS), attempts: { increment: 1 },
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
      const resendEmailId = await deliver({ to: claimed.recipientEmail!, from: claimed.fromEmail!, url: claimed.conversationUrl!, idempotencyKey: `universident-chat/${claimed.id}` });
      const sentAt = new Date(Math.max(now.getTime(), Date.now()));
      await prisma.$transaction(async (db) => {
        await lockMailbox(db, candidate.mailbox.appointmentId, candidate.mailbox.recipientUserId);
        const updated = await db.chatEmailBatch.updateMany({ where: { id: claimed.id, status: "SENDING", leaseToken: claimed.leaseToken }, data: { status: "SENT", sentAt, resendEmailId: resendEmailId ?? null, leaseUntil: null, lastErrorCode: null } });
        if (updated.count) await db.chatMailbox.update({ where: { id: claimed.mailboxId }, data: { lastSentAt: sentAt } });
      });
      sent++;
    } catch {
      failed++;
      await prisma.chatEmailBatch.updateMany({ where: { id: claimed.id, status: "SENDING", leaseToken: claimed.leaseToken }, data: {
        status: claimed.attempts >= EMAIL_MAX_ATTEMPTS ? "FAILED" : "SENDING", leaseUntil: null,
        dueAt: emailRetryDueAt(claimed.attempts, now), lastErrorCode: "DELIVERY_FAILED",
      } });
    }
  }
  // Only throttle metadata is removed. Conversation history is retained.
  await prisma.chatSendAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { sent, failed, ...await getChatEmailQueueStatus(now) };
}
