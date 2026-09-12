import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ChatError } from "./errors";
import { moderateChatMessage, MODERATION_PROMPT_VERSION } from "./moderation";
import { chatState, nextEmailDueAt } from "./policy";
import { chatSlugWhere } from "./slug";
import type { ChatConversationDto, ChatMessageDto } from "./types";

type Actor = { id: string; role: string };
type Database = Prisma.TransactionClient;
const appointmentSelect = {
  id: true, routeSlug: true, chatSlug: true, status: true, confirmedAt: true, statusChangedAt: true,
  scheduledStartsAt: true, treatmentNameSnapshot: true,
  patientProfile: { select: { userId: true, user: { select: { name: true } } } },
  studentProfile: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.AppointmentSelect;
type Appointment = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;

function ownerWhere(actor: Actor): Prisma.AppointmentWhereInput {
  if (actor.role !== "PATIENT" && actor.role !== "STUDENT") throw new ChatError("NOT_FOUND", "Conversația nu este disponibilă.", 404);
  return actor.role === "PATIENT" ? { patientProfile: { userId: actor.id } } : { studentProfile: { userId: actor.id } };
}

export async function chatAppointment(slug: string, actor: Actor, db: Database = prisma) {
  const appointment = await db.appointment.findFirst({
    where: { ...chatSlugWhere(slug), confirmedAt: { not: null }, ...ownerWhere(actor) },
    select: appointmentSelect,
  });
  if (!appointment) throw new ChatError("NOT_FOUND", "Conversația nu este disponibilă.", 404);
  return appointment;
}

function conversationDto(appointment: Appointment, actor: Actor): ChatConversationDto {
  return {
    slug: appointment.chatSlug,
    appointmentSlug: appointment.routeSlug,
    counterpartName: actor.role === "PATIENT" ? appointment.studentProfile.user.name : appointment.patientProfile.user.name,
    treatment: appointment.treatmentNameSnapshot,
    startsAt: appointment.scheduledStartsAt.toISOString(),
    ...chatState(appointment),
    unreadCount: 0, lastMessage: null, lastMessageAt: null,
  };
}

export function messageDto(message: { id: string; text: string; senderUserId: string; createdAt: Date; readAt: Date | null }, userId: string): ChatMessageDto {
  return { id: message.id, text: message.text, own: message.senderUserId === userId, createdAt: message.createdAt.toISOString(), readAt: message.readAt?.toISOString() ?? null };
}

export async function unreadChatCount(actor: Actor) {
  ownerWhere(actor);
  const rows = await prisma.chatMessage.groupBy({
    by: ["appointmentId"], where: { recipientUserId: actor.id, readAt: null },
  });
  return rows.length;
}

export async function listChatConversations(actor: Actor, past = false, cursor?: string) {
  const where = { ...ownerWhere(actor), confirmedAt: { not: null }, status: past ? { not: "CONFIRMED" as const } : "CONFIRMED" as const };
  if (cursor && !await prisma.appointment.findFirst({ where: { ...where, ...chatSlugWhere(cursor) }, select: { id: true } })) {
    throw new ChatError("INVALID_CURSOR", "Reîncarcă lista conversațiilor.");
  }
  const appointments = await prisma.appointment.findMany({
    where, orderBy: [{ scheduledStartsAt: "desc" }, { id: "desc" }], take: 25,
    ...(cursor ? { cursor: chatSlugWhere(cursor), skip: 1 } : {}),
    select: { ...appointmentSelect,
      chatMessages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { text: true, createdAt: true } },
      _count: { select: { chatMessages: { where: { recipientUserId: actor.id, readAt: null } } } },
    },
  });
  const page = appointments.slice(0, 24);
  return {
    conversations: page.map((a) => ({ ...conversationDto(a, actor), unreadCount: a._count.chatMessages, lastMessage: a.chatMessages[0]?.text ?? null, lastMessageAt: a.chatMessages[0]?.createdAt.toISOString() ?? null })),
    nextCursor: appointments.length > 24 ? page.at(-1)!.chatSlug : null,
  };
}

export async function getChatPage(slug: string, actor: Actor, cursor?: string) {
  const appointment = await chatAppointment(slug, actor);
  if (cursor && !await prisma.chatMessage.findFirst({ where: { id: cursor, appointmentId: appointment.id }, select: { id: true } })) {
    throw new ChatError("INVALID_CURSOR", "Reîncarcă conversația.");
  }
  const messages = await prisma.chatMessage.findMany({
    where: { appointmentId: appointment.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = messages.slice(0, 50);
  return { conversation: conversationDto(appointment, actor), messages: page.toReversed().map((m) => messageDto(m, actor.id)), olderCursor: messages.length > 50 ? page.at(-1)!.id : null };
}

export async function acknowledgeChatMessages(slug: string, actor: Actor, ids: string[]) {
  const appointment = await chatAppointment(slug, actor);
  await prisma.chatMessage.updateMany({
    where: { appointmentId: appointment.id, recipientUserId: actor.id, id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function lockMailbox(db: Database, appointmentId: string, recipientUserId: string) {
  const key = `universident:chat-mailbox:${appointmentId}:${recipientUserId}`;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

async function consumeAttempt(userId: string) {
  await prisma.$transaction(async (db) => {
    const key = `universident:chat-attempt:${userId}`;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const now = Date.now();
    const count = await db.chatSendAttempt.count({ where: { userId, createdAt: { gt: new Date(now - 60_000) } } });
    const hourCount = await db.chatSendAttempt.count({ where: { userId, createdAt: { gt: new Date(now - 3_600_000) } } });
    if (count >= 20 || hourCount >= 200) throw new ChatError("RATE_LIMITED", "Ai trimis prea multe mesaje. Așteaptă puțin și încearcă din nou.", 429);
    await db.chatSendAttempt.deleteMany({ where: { userId, createdAt: { lt: new Date(now - 86_400_000) } } });
    await db.chatSendAttempt.create({ data: { userId } });
  });
}

export async function sendChatMessage(slug: string, actor: Actor, input: { text: string; clientId: string }, moderate = moderateChatMessage) {
  const appointment = await chatAppointment(slug, actor);
  const lookup = { senderUserId_clientId: { senderUserId: actor.id, clientId: input.clientId } };
  const duplicate = async (db: Database = prisma) => {
    const message = await db.chatMessage.findUnique({ where: lookup });
    if (message && (message.appointmentId !== appointment.id || message.text !== input.text)) throw new ChatError("IDEMPOTENCY_CONFLICT", "Cererea a fost deja folosită pentru alt mesaj. Reîncarcă pagina.", 409);
    return message;
  };
  const existing = await duplicate();
  if (existing) return messageDto(existing, actor.id);
  if (!chatState(appointment).canSend) throw new ChatError("CHAT_CLOSED", "Au trecut cele 7 zile. Conversația poate fi doar citită.", 409);
  await consumeAttempt(actor.id);
  const verdict = await moderate(input.text);
  if (verdict.decision !== "ALLOW") throw new ChatError("MESSAGE_BLOCKED", "Mesajul nu a fost trimis deoarece a fost identificat ca posibil abuziv. Reformulează-l fără jigniri sau amenințări și încearcă din nou.", 422);
  try {
    const message = await prisma.$transaction(async (db) => {
      // Recheck after the external moderation call; a status change may have closed the chat.
      await db.$queryRaw`SELECT id FROM appointment WHERE id = ${appointment.id} FOR UPDATE`;
      const fresh = await chatAppointment(slug, actor, db);
      const repeat = await duplicate(db);
      if (repeat) return repeat;
      if (!chatState(fresh).canSend) throw new ChatError("CHAT_CLOSED", "Conversația poate fi doar citită.", 409);
      const recipientUserId = actor.role === "PATIENT" ? fresh.studentProfile.userId : fresh.patientProfile.userId;
      await lockMailbox(db, fresh.id, recipientUserId);
      const mailbox = await db.chatMailbox.upsert({
        where: { appointmentId_recipientUserId: { appointmentId: fresh.id, recipientUserId } },
        create: { appointmentId: fresh.id, recipientUserId }, update: {},
      });
      const pending = await db.chatEmailBatch.findFirst({ where: { mailboxId: mailbox.id, status: "PENDING" } });
      const batch = pending ?? await db.chatEmailBatch.create({ data: { mailboxId: mailbox.id, dueAt: nextEmailDueAt(new Date(), mailbox.lastSentAt) } });
      return db.chatMessage.create({ data: {
        appointmentId: fresh.id, senderUserId: actor.id, recipientUserId,
        clientId: input.clientId, text: input.text, moderationVersion: MODERATION_PROMPT_VERSION, emailBatchId: batch.id,
      } });
    });
    return messageDto(message, actor.id);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const repeat = await duplicate();
      if (repeat) return messageDto(repeat, actor.id);
    }
    throw error;
  }
}
