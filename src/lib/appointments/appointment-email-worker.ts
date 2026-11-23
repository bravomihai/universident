import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { AppointmentEmailKind } from "@/generated/prisma/enums";
import { hasAppointmentReview } from "@/lib/appointments/appointment-presentation";
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

const emailCopy = {
  REQUEST_CREATED: {
    subject: "Ai primit o cerere de programare pe Universident",
    message: "Un pacient ți-a trimis o cerere de programare. Poți vedea detaliile și răspunde din cont.",
  },
  CONFIRMED: {
    subject: "Cererea ta a fost confirmată pe Universident",
    message: "Studentul a acceptat cererea ta. Detaliile programării sunt disponibile în cont.",
  },
  REJECTED: {
    subject: "Cererea ta a fost refuzată pe Universident",
    message: "Cererea ta de programare a fost refuzată. Poți vedea detaliile în cont.",
  },
  CANCELLED_BY_PATIENT: {
    subject: "Pacientul a anulat o programare pe Universident",
    message: "Pacientul a anulat o programare. Poți vedea detaliile în cont.",
  },
  STUDENT_REVIEW: {
    subject: "Înregistrează rezultatul programării pe Universident",
    message: "Ora de final a programării a trecut. Înregistrează rezultatul și lasă o recenzie în cont.",
  },
  PATIENT_REVIEW: {
    subject: "Lasă o recenzie pe Universident",
    message: "Programarea a fost marcată ca finalizată. Poți lăsa o recenzie în cont.",
  },
} satisfies Record<AppointmentEmailKind, { subject: string; message: string }>;

type AppointmentEmailPayload = EmailEnvelope & { kind: AppointmentEmailKind; url: string };

export function deliverAppointmentEmail({ kind, url, ...envelope }: AppointmentEmailPayload) {
  const { subject, message } = emailCopy[kind];
  return sendResendEmail({
    ...envelope,
    subject,
    text: `${message}

Deschide programările: ${url}`,
    html: `<p>${message}</p><p><a href="${escapeEmailHtml(url)}">Deschide programările</a></p>`,
  });
}

const recipient = { select: { user: { select: { email: true, emailVerified: true } } } } as const;
const appointmentSelect = {
  status: true,
  participantDeleted: true,
  pendingExpiresAt: true,
  scheduledEndsAt: true,
  patientProfile: recipient,
  studentProfile: recipient,
  reviews: { select: { authorRole: true } },
} satisfies Prisma.AppointmentSelect;

type EmailAppointment = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;

function eligibleRecipient(appointment: EmailAppointment | null, kind: AppointmentEmailKind, now: Date) {
  if (!appointment || appointment.participantDeleted) return null;

  const canSend = {
    REQUEST_CREATED: appointment.status === "PENDING" &&
      appointment.pendingExpiresAt !== null && appointment.pendingExpiresAt > now,
    CONFIRMED: appointment.status === "CONFIRMED",
    REJECTED: appointment.status === "REJECTED",
    CANCELLED_BY_PATIENT: appointment.status === "CANCELLED_BY_PATIENT",
    STUDENT_REVIEW: appointment.status === "CONFIRMED" && appointment.scheduledEndsAt <= now &&
      !hasAppointmentReview(appointment, "STUDENT"),
    PATIENT_REVIEW: appointment.status === "COMPLETED" && !hasAppointmentReview(appointment, "PATIENT"),
  };

  if (!canSend[kind]) return null;
  const forStudent = kind === "REQUEST_CREATED" || kind === "STUDENT_REVIEW" || kind === "CANCELLED_BY_PATIENT";
  const profile = forStudent ? appointment.studentProfile : appointment.patientProfile;
  return profile.user.emailVerified ? profile.user.email : null;
}

export async function processAppointmentEmails(
  deliver: (payload: AppointmentEmailPayload) => Promise<string | null | void> = deliverAppointmentEmail,
  now = new Date(),
) {
  const { origin, from } = getTransactionalEmailConfig();
  const available = {
    status: { in: ["PENDING", "SENDING"] },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  } satisfies Prisma.AppointmentEmailWhereInput;
  const due = { ...available, dueAt: { lte: now } };
  const candidates = await prisma.appointmentEmail.findMany({
    where: due,
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: 5,
    include: { appointment: { select: appointmentSelect } },
  });

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const id = candidate.id;
    const where = { id, attempts: candidate.attempts, ...due };
    const to = eligibleRecipient(candidate.appointment, candidate.kind, now);
    if (!to || (candidate.recipientEmail && candidate.recipientEmail !== to)) {
      await prisma.appointmentEmail.updateMany({
        where, data: { status: "SKIPPED", leaseUntil: null },
      });
      continue;
    }
    if (candidate.attempts >= EMAIL_MAX_ATTEMPTS ||
        (candidate.firstAttemptAt && now.getTime() - candidate.firstAttemptAt.getTime() >= EMAIL_MAX_RETRY_AGE_MS)) {
      await prisma.appointmentEmail.updateMany({
        where, data: { status: "FAILED", lastErrorCode: "RETRIES_EXHAUSTED", leaseUntil: null },
      });
      continue;
    }

    const leaseToken = randomUUID();
    const fromEmail = candidate.fromEmail ?? from;
    const url = candidate.appointmentsUrl ?? `${origin}/cont/programari`;
    const claim = await prisma.appointmentEmail.updateMany({
      where,
      data: {
        status: "SENDING",
        leaseToken,
        leaseUntil: new Date(Math.max(now.getTime(), Date.now()) + EMAIL_LEASE_MS),
        attempts: { increment: 1 },
        firstAttemptAt: candidate.firstAttemptAt ?? now,
        recipientEmail: to,
        fromEmail,
        appointmentsUrl: url,
      },
    });
    if (!claim.count) continue;

    const owned = { id, leaseToken, status: "SENDING" } as const;
    try {
      // An appointment may have changed or expired while the worker was claiming the email.
      const fresh = await prisma.appointment.findUnique({
        where: { id: candidate.appointmentId },
        select: appointmentSelect,
      });
      const deliveryTime = new Date(Math.max(now.getTime(), Date.now()));
      if (eligibleRecipient(fresh, candidate.kind, deliveryTime) !== to) {
        await prisma.appointmentEmail.updateMany({
          where: owned, data: { status: "SKIPPED", leaseUntil: null },
        });
        continue;
      }
      const resendEmailId = await deliver({
        to, from: fromEmail, kind: candidate.kind, url, idempotencyKey: `universident-appointment/${id}`,
      });
      const updated = await prisma.appointmentEmail.updateMany({
        where: owned,
        data: {
          status: "SENT",
          sentAt: new Date(Math.max(now.getTime(), Date.now())),
          resendEmailId: resendEmailId ?? null,
          leaseUntil: null,
          lastErrorCode: null,
        },
      });
      sent += updated.count;
    } catch {
      failed++;
      const attempts = candidate.attempts + 1;
      await prisma.appointmentEmail.updateMany({
        where: owned,
        data: {
          status: attempts >= EMAIL_MAX_ATTEMPTS ? "FAILED" : "SENDING",
          leaseUntil: null,
          dueAt: emailRetryDueAt(attempts, now),
          lastErrorCode: "DELIVERY_FAILED",
        },
      });
    }
  }

  const [failedBatches, overdueBatches] = await Promise.all([
    prisma.appointmentEmail.count({ where: { status: "FAILED" } }),
    prisma.appointmentEmail.count({
      where: { ...available, dueAt: { lt: new Date(now.getTime() - EMAIL_OVERDUE_MS) } },
    }),
  ]);
  return { sent, failed, failedBatches, overdueBatches };
}
