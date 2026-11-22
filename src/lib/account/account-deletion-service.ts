import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  accountDeletionDigest,
  accountDeletionLinkLifetimeMs,
  accountDeletionReason,
  accountDeletionTransition,
  deletedAccountName,
} from "@/lib/account/account-deletion-policy";
import { escapeEmailHtml, getTransactionalEmailConfig, sendResendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { lockSchedulingKeys, patientBookingLockKey, studentCalendarLockKey } from "@/lib/scheduling/locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

const verificationPrefix = "universident:account-deletion:";
const requestCooldownMs = 60_000;

export class AccountDeletionError extends Error {
  constructor(readonly code: "INVALID_LINK" | "RATE_LIMITED" | "ACCOUNT_UNAVAILABLE") {
    super(code);
  }
}

export async function accountDeletionIdentity(userId: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId, emailVerified: true, role: { in: ["PATIENT", "STUDENT"] } },
    select: { id: true, email: true, role: true, accounts: {
      where: { providerId: "credential" }, select: { password: true }, take: 1,
    } },
  });
  const passwordHash = user?.accounts[0]?.password;
  if (!user || !passwordHash) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fingerprint: accountDeletionDigest(JSON.stringify([user.email, passwordHash])),
  };
}

export async function requestAccountDeletion(identity: NonNullable<Awaited<ReturnType<typeof accountDeletionIdentity>>>) {
  const { origin, from } = getTransactionalEmailConfig();
  const token = randomBytes(32).toString("base64url");
  const identifier = verificationPrefix + accountDeletionDigest(token);
  const id = verificationPrefix + identity.id;
  await runSerializableTransaction(prisma, async (db) => {
    await lockSchedulingKeys(db, [id]);
    const current = await accountDeletionIdentity(identity.id, db);
    if (current?.fingerprint !== identity.fingerprint) throw new AccountDeletionError("ACCOUNT_UNAVAILABLE");
    const previous = await db.verification.findUnique({ where: { id } });
    const now = Date.now();
    if (previous && previous.updatedAt.getTime() > now - requestCooldownMs) {
      throw new AccountDeletionError("RATE_LIMITED");
    }
    const data = { identifier, value: identity.fingerprint, expiresAt: new Date(now + accountDeletionLinkLifetimeMs) };
    await db.verification.upsert({ where: { id }, create: { id, ...data }, update: data });
  });

  // Fragments stay out of the HTTP request URL and server access logs.
  const url = `${origin}/confirma-stergerea-contului#${token}`;
  const subject = "Confirmă ștergerea contului Universident";
  try {
    await sendResendEmail({
      from, to: identity.email, idempotencyKey: `universident-account-deletion/${accountDeletionDigest(token)}`,
      subject,
      text: `Ai cerut să îți ștergi contul Universident. Deschide acest link pentru a confirma: ${url}\n\nLinkul este valabil o oră. Dacă nu ai cerut ștergerea, poți ignora mesajul.`,
      html: `<p>Ai cerut să îți ștergi contul Universident.</p><p><a href="${escapeEmailHtml(url)}">Deschide pagina de confirmare</a></p><p>Linkul este valabil o oră. Dacă nu ai cerut ștergerea, poți ignora mesajul.</p>`,
    });
  } catch (error) {
    await prisma.verification.deleteMany({ where: { id, identifier } });
    throw error;
  }
}

async function removeStudentData(db: Prisma.TransactionClient, studentProfileId: string, placeholderId: string | null, now: Date) {
  await db.studentProfileImage.deleteMany({ where: { studentProfileId } });
  await db.studentAvailabilitySlot.deleteMany({ where: { studentProfileId, appointments: { none: {} } } });
  await db.studentAvailabilitySeries.deleteMany({ where: { studentProfileId, slots: { none: {} } } });
  await db.studentLocation.deleteMany({ where: { studentProfileId, availabilitySlots: { none: {} }, availabilitySeries: { none: {} } } });
  await db.studentTreatment.deleteMany({ where: { studentProfileId, slotOfferings: { none: {} }, seriesOfferings: { none: {} } } });
  if (!placeholderId) return;

  await db.studentProfile.update({ where: { id: studentProfileId }, data: {
    userId: placeholderId, bio: null, university: "", studyYear: 0, publicSlug: null,
    isPublished: false, publishedAt: null, lastRefreshedAt: null, showCompletedAppointmentsCount: false,
  } });
  await db.studentLocation.updateMany({ where: { studentProfileId }, data: {
    name: "Locație retrasă", address: "Adresă retrasă", details: null, deletedAt: now,
  } });
  await db.studentTreatment.updateMany({ where: { studentProfileId }, data: { description: null, deletedAt: now } });
  await db.studentAvailabilitySeries.updateMany({ where: { studentProfileId, status: "ACTIVE" }, data: {
    status: "CANCELLED", revision: { increment: 1 },
  } });
  await db.studentAvailabilitySlot.updateMany({ where: { studentProfileId, status: "ACTIVE", startsAt: { gt: now } }, data: {
    status: "CANCELLED", cancelledAt: now, version: { increment: 1 },
  } });
}

export async function confirmAccountDeletion(token: string) {
  if (!/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new AccountDeletionError("INVALID_LINK");
  const identifier = verificationPrefix + accountDeletionDigest(token);
  await runSerializableTransaction(prisma, async (db) => {
    const verification = await db.verification.findFirst({ where: { identifier } });
    if (!verification || !verification.id.startsWith(verificationPrefix)) throw new AccountDeletionError("INVALID_LINK");
    const userId = verification.id.slice(verificationPrefix.length);
    const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    await lockSchedulingKeys(db, [verification.id, patientBookingLockKey(userId),
      ...(student ? [studentCalendarLockKey(student.id)] : []),
    ]);
    const now = new Date();
    if (verification.expiresAt <= now) throw new AccountDeletionError("INVALID_LINK");
    const identity = await accountDeletionIdentity(userId, db);
    if (!identity || identity.fingerprint !== verification.value) throw new AccountDeletionError("INVALID_LINK");
    const consumed = await db.verification.deleteMany({ where: { id: verification.id, identifier, expiresAt: { gt: now } } });
    if (!consumed.count) throw new AccountDeletionError("INVALID_LINK");

    const participant = { OR: [{ patientProfile: { userId } }, { studentProfile: { userId } }] };
    const appointments = await db.appointment.findMany({ where: participant, select: {
      id: true, status: true, statusReason: true, scheduledStartsAt: true, pendingExpiresAt: true, participantDeleted: true,
      patientProfile: { select: { id: true, userId: true } },
      studentProfile: { select: { id: true, userId: true } },
    } });
    const notifications: Prisma.AppointmentNotificationCreateManyInput[] = [];
    for (const appointment of appointments) {
      const isPatient = appointment.patientProfile.userId === userId;
      const transition = appointment.participantDeleted ? null : accountDeletionTransition(
        appointment.status, appointment.scheduledStartsAt, appointment.pendingExpiresAt,
        isPatient ? "PATIENT" : "STUDENT", now,
      );
      await db.appointment.update({ where: { id: appointment.id }, data: {
        participantDeleted: true,
        version: { increment: 1 },
        patientNote: null,
        idempotencyKeyHash: null,
        idempotencyRequestHash: null,
        ...(isPatient ? { patientNameSnapshot: deletedAccountName, patientAgeAtAppointment: null } : {
          studentNameSnapshot: deletedAccountName, studentUniversitySnapshot: "",
          locationNameSnapshot: "Locație retrasă", locationAddressSnapshot: "",
        }),
        statusReason: transition || appointment.statusReason !== null ? accountDeletionReason : null,
        ...(transition ? { ...transition, pendingExpiresAt: null, statusChangedAt: now,
          statusChangedByUserId: null, statusReasonCode: "ACCOUNT_DELETED" } : {}),
      } });
      if (transition) notifications.push({ appointmentId: appointment.id, createdAt: now,
        recipientUserId: isPatient ? appointment.studentProfile.userId : appointment.patientProfile.userId,
        eventType: transition.status === "CONFIRMED" ? "CLOSED_ACCOUNT_DELETED" : transition.status,
      });
    }

    await db.appointmentEmail.deleteMany({ where: { appointment: participant } });
    await db.chatMessage.deleteMany({ where: { appointment: participant } });
    await db.chatEmailBatch.deleteMany({ where: { mailbox: { appointment: participant } } });
    await db.chatMailbox.deleteMany({ where: { appointment: participant } });
    await db.appointmentReview.deleteMany({ where: { OR: [{ authorUserId: userId }, { targetUserId: userId }] } });
    await db.appointmentNotification.deleteMany({ where: { recipientUserId: userId } });
    if (notifications.length) await db.appointmentNotification.createMany({ data: notifications });

    // Restrict relations retain the shared appointments under a credential-free placeholder.
    const patientKept = appointments.find((appointment) => appointment.patientProfile.userId === userId)?.patientProfile.id;
    const studentKept = appointments.find((appointment) => appointment.studentProfile.userId === userId)?.studentProfile.id;
    const placeholderId = (patientKept || studentKept) ? randomUUID() : null;
    if (placeholderId) await db.user.create({ data: {
      id: placeholderId, email: `${placeholderId}@account-deleted.invalid`, name: deletedAccountName, role: identity.role,
    } });
    if (student) await removeStudentData(db, student.id, studentKept ? placeholderId : null, now);
    if (patientKept && placeholderId) {
      await db.patientProfileImage.deleteMany({ where: { patientProfileId: patientKept } });
      await db.patientProfile.update({ where: { id: patientKept }, data: {
        userId: placeholderId, profileSlug: randomUUID(), dateOfBirth: null, bio: null,
      } });
    }
    await db.verification.deleteMany({ where: { OR: [
      { identifier: identity.email }, { value: userId },
    ] } });
    await db.user.delete({ where: { id: userId } });
  });
}
