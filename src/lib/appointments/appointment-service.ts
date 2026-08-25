import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  AppointmentReviewAuthorRole,
  AppointmentStatus,
  StudentAvailabilitySeriesStatus,
  UserRole,
} from "@/generated/prisma/enums";
import type {
  parseAppointmentActionInput,
  parseAppointmentReviewInput,
  parseCreateAppointmentInput,
} from "@/lib/appointments/appointment-input";
import { appointmentNotificationAcknowledgementWhere } from "@/lib/appointments/appointment-notification";
import { appointmentReviewIsAllowed } from "@/lib/appointments/appointment-presentation";
import {
  createAppointmentRouteSlug,
  createPatientProfileSlug,
} from "@/lib/appointments/appointment-route-slug";
import { ageOnDate } from "@/lib/availability/bucharest-time";
import { generateSmartBookingSlots } from "@/lib/availability/smart-booking-slots";
import { parsePatientProfileInput } from "@/lib/patient/patient-profile-input";
import { prisma } from "@/lib/prisma";
import {
  findAndLockAvailabilityRoot,
  lockSchedulingKeys,
  patientBookingLockKey,
} from "@/lib/scheduling/locks";
import { runSerializableTransaction } from "@/lib/scheduling/transaction";

type SuccessData<T> = T extends { ok: true; data: infer Data } ? Data : never;
type Parsed<T extends (value: unknown) => unknown> = SuccessData<ReturnType<T>>;

export type AppointmentDomainErrorCode =
  | "PROFILE_REQUIRED"
  | "SLOT_NOT_FOUND"
  | "SLOT_UNAVAILABLE"
  | "APPOINTMENT_NOT_FOUND"
  | "ACTION_NOT_ALLOWED"
  | "ALREADY_STARTED"
  | "NOT_STARTED"
  | "PATIENT_TIME_CONFLICT"
  | "REVIEW_REQUIRED"
  | "REVIEW_ALREADY_SUBMITTED"
  | "REVIEW_NOT_AVAILABLE"
  | "PENDING_LIMIT_REACHED"
  | "IDEMPOTENCY_CONFLICT"
  | "STALE_VERSION";

export class AppointmentDomainError extends Error {
  constructor(
    readonly code: AppointmentDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_FUTURE_PENDING_APPOINTMENTS = 3;
export const PENDING_REQUEST_LIFETIME_MS = 24 * 60 * 60_000;
export const MAX_PENDING_EXPIRATIONS_PER_OPERATION = 100;

const appointmentInclude = {
  patientProfile: {
    select: {
      id: true,
      profileSlug: true,
      user: {
        select: {
          id: true,
          name: true,
          reviewsReceived: {
            where: { publishedAt: { not: null } },
            select: { rating: true },
          },
        },
      },
    },
  },
  studentProfile: {
    select: {
      id: true,
      publicSlug: true,
      university: true,
      studyYear: true,
      user: {
        select: {
          id: true,
          name: true,
          reviewsReceived: {
            where: { publishedAt: { not: null } },
            select: { rating: true },
          },
        },
      },
    },
  },
  reviews: {
    select: {
      authorRole: true,
      submittedAt: true,
    },
  },
} satisfies Prisma.AppointmentInclude;

function privateAppointmentInclude(userId: string) {
  return {
    ...appointmentInclude,
    reviews: {
      where: { authorUserId: userId },
      select: {
        authorRole: true,
        rating: true,
        comment: true,
        submittedAt: true,
        publishedAt: true,
      },
    },
  } satisfies Prisma.AppointmentInclude;
}

async function publishAppointmentReviews(
  transaction: Prisma.TransactionClient,
  appointmentId: string,
  now: Date,
) {
  const submitted = await transaction.appointmentReview.count({
    where: { appointmentId },
  });
  if (submitted < 2) return;
  await transaction.appointmentReview.updateMany({
    where: { appointmentId, publishedAt: null },
    data: { publishedAt: now },
  });
}

async function createAppointmentNotifications(
  transaction: Prisma.TransactionClient,
  notifications: Array<{
    appointmentId: string;
    recipientUserId: string;
    eventType: string;
    createdAt: Date;
  }>,
) {
  if (notifications.length === 0) return;
  await transaction.appointmentNotification.createMany({ data: notifications });
}

export async function expirePendingAppointments(
  transaction: Prisma.TransactionClient,
  now = new Date(),
  scope: {
    patientProfileId?: string;
    studentProfileId?: string;
    availabilitySlotId?: string;
    limit?: number;
  } = {},
) {
  const expiring = await transaction.appointment.findMany({
    where: {
      status: AppointmentStatus.PENDING,
      pendingExpiresAt: { lte: now },
      ...(scope.patientProfileId ? { patientProfileId: scope.patientProfileId } : {}),
      ...(scope.studentProfileId ? { studentProfileId: scope.studentProfileId } : {}),
      ...(scope.availabilitySlotId
        ? { studentAvailabilitySlotId: scope.availabilitySlotId }
        : {}),
    },
    orderBy: { pendingExpiresAt: "asc" },
    take: Math.min(scope.limit ?? MAX_PENDING_EXPIRATIONS_PER_OPERATION, MAX_PENDING_EXPIRATIONS_PER_OPERATION),
    select: {
      id: true,
      patientProfileId: true,
      studentProfileId: true,
    },
  });
  if (expiring.length === 0) return { count: 0 };

  const patientProfiles = await transaction.patientProfile.findMany({
    where: {
      id: { in: expiring.map((appointment) => appointment.patientProfileId) },
    },
    select: { id: true, userId: true },
  });
  const studentProfiles = await transaction.studentProfile.findMany({
    where: {
      id: { in: expiring.map((appointment) => appointment.studentProfileId) },
    },
    select: { id: true, userId: true },
  });
  const patientUserIds = new Map(
    patientProfiles.map((profile) => [profile.id, profile.userId]),
  );
  const studentUserIds = new Map(
    studentProfiles.map((profile) => [profile.id, profile.userId]),
  );

  const expired = await transaction.appointment.updateManyAndReturn({
    where: {
      id: { in: expiring.map((appointment) => appointment.id) },
      status: AppointmentStatus.PENDING,
      pendingExpiresAt: { lte: now },
    },
    data: {
      status: AppointmentStatus.EXPIRED,
      statusReason: "Cererea a expirat după 24 de ore sau la ora programată, oricare a venit prima.",
      statusReasonCode: "PENDING_DEADLINE_REACHED",
      statusChangedAt: now,
      expiredAt: now,
      version: { increment: 1 },
    },
    select: { id: true },
  });
  const expiredIds = new Set(expired.map((appointment) => appointment.id));
  await createAppointmentNotifications(
    transaction,
    expiring
      .filter((appointment) => expiredIds.has(appointment.id))
      .flatMap((appointment) => {
        const patientUserId = patientUserIds.get(appointment.patientProfileId);
        const studentUserId = studentUserIds.get(appointment.studentProfileId);
        if (!patientUserId || !studentUserId) return [];
        return [
          {
            appointmentId: appointment.id,
            recipientUserId: patientUserId,
            eventType: AppointmentStatus.EXPIRED,
            createdAt: now,
          },
          {
            appointmentId: appointment.id,
            recipientUserId: studentUserId,
            eventType: AppointmentStatus.EXPIRED,
            createdAt: now,
          },
        ];
      }),
  );
  return { count: expired.length };
}

export function appointmentConsumesCapacityWhere(now: Date): Prisma.AppointmentWhereInput {
  return {
    OR: [
      { status: AppointmentStatus.CONFIRMED },
      {
        status: AppointmentStatus.PENDING,
        pendingExpiresAt: { gt: now },
      },
    ],
  };
}

async function getOrCreatePatientProfile(
  transaction: Prisma.TransactionClient,
  user: { id: string; name: string },
  dateOfBirthInput: string | null,
) {
  let profile = await transaction.patientProfile.findUnique({
    where: { userId: user.id },
  });
  if (dateOfBirthInput && !profile?.dateOfBirth) {
    const parsed = parsePatientProfileInput({ dateOfBirth: dateOfBirthInput });
    if (!parsed.ok) throw new AppointmentDomainError("PROFILE_REQUIRED", parsed.error);
    profile = profile
      ? await transaction.patientProfile.update({
          where: { id: profile.id },
          data: { dateOfBirth: parsed.data.dateOfBirth },
        })
      : await transaction.patientProfile.create({
          data: {
            userId: user.id,
            profileSlug: createPatientProfileSlug(user.name),
            dateOfBirth: parsed.data.dateOfBirth,
          },
        });
  }
  if (!profile?.dateOfBirth) {
    throw new AppointmentDomainError(
      "PROFILE_REQUIRED",
      "Completează data nașterii înainte de a trimite cererea.",
    );
  }
  return profile;
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function isIdempotencyUniqueConflict(error: unknown) {
  if (!isUniqueConflict(error)) return false;
  const serialized = JSON.stringify(error);
  return serialized.includes("idempotencyKeyHash") ||
    serialized.includes("appointment_idempotency_key_hash_key");
}

function isPatientOverlap(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  return message.includes("appointment_patient_confirmed_time_excl");
}

function isStudentActiveOverlap(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  return message.includes("appointment_student_active_time_excl");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function idempotencyHashes(
  patientUserId: string,
  studentSlug: string,
  input: Parsed<typeof parseCreateAppointmentInput>,
) {
  return {
    keyHash: sha256(JSON.stringify([patientUserId, input.idempotencyKey])),
    requestHash: sha256(JSON.stringify([
      studentSlug,
      input.slotId,
      input.offeringId,
      input.startsAt.toISOString(),
      input.patientNote,
      input.dateOfBirth,
    ])),
  };
}

export async function createAppointmentRequest(
  patientUser: { id: string; name: string },
  studentSlug: string,
  input: Parsed<typeof parseCreateAppointmentInput>,
  options: {
    now?: Date;
    afterPatientLock?: () => Promise<void>;
    afterRootLock?: () => Promise<void>;
  } = {},
) {
  const hashes = idempotencyHashes(patientUser.id, studentSlug, input);
  try {
    return await runSerializableTransaction(
      prisma,
      async (transaction) => {
        const now = options.now ?? new Date();
        await lockSchedulingKeys(transaction, [patientBookingLockKey(patientUser.id)]);
        await options.afterPatientLock?.();
        const patient = await getOrCreatePatientProfile(
          transaction,
          patientUser,
          input.dateOfBirth,
        );
        const existingIdempotent = await transaction.appointment.findUnique({
          where: { idempotencyKeyHash: hashes.keyHash },
          select: {
            id: true,
            patientProfileId: true,
            idempotencyRequestHash: true,
          },
        });
        if (existingIdempotent) {
          if (
            existingIdempotent.patientProfileId !== patient.id ||
            existingIdempotent.idempotencyRequestHash !== hashes.requestHash
          ) {
            throw new AppointmentDomainError(
              "IDEMPOTENCY_CONFLICT",
              "Cheia cererii a fost deja folosită pentru altă programare.",
            );
          }
          return transaction.appointment.findUniqueOrThrow({
            where: { id: existingIdempotent.id },
            include: appointmentInclude,
          });
        }

        await expirePendingAppointments(transaction, now, { patientProfileId: patient.id });
        const pendingCount = await transaction.appointment.count({
          where: {
            patientProfileId: patient.id,
            status: AppointmentStatus.PENDING,
            pendingExpiresAt: { gt: now },
          },
        });
        if (pendingCount >= MAX_FUTURE_PENDING_APPOINTMENTS) {
          throw new AppointmentDomainError(
            "PENDING_LIMIT_REACHED",
            "Poți avea cel mult 3 cereri viitoare în așteptare.",
          );
        }

        const root = await findAndLockAvailabilityRoot(transaction, input.slotId);
        if (!root) {
          throw new AppointmentDomainError(
            "SLOT_UNAVAILABLE",
            "Slotul nu mai este disponibil. Alege alt interval.",
          );
        }
        await options.afterRootLock?.();
        await expirePendingAppointments(transaction, now, {
          availabilitySlotId: input.slotId,
        });
        const slot = await transaction.studentAvailabilitySlot.findFirst({
          where: {
            id: input.slotId,
            status: "ACTIVE",
            startsAt: { lte: input.startsAt },
            endsAt: { gt: input.startsAt },
            studentProfile: { publicSlug: studentSlug, isPublished: true },
            studentLocation: { deletedAt: null, city: { isActive: true } },
            OR: [
              { seriesId: null },
              { series: { status: StudentAvailabilitySeriesStatus.ACTIVE } },
            ],
          },
          include: {
            studentProfile: { include: { user: true } },
            studentLocation: true,
            offerings: {
              where: { removedAt: null },
              include: {
                studentTreatment: { include: { treatment: true } },
                supervisor: true,
              },
            },
            appointments: {
              where: appointmentConsumesCapacityWhere(now),
              select: { scheduledStartsAt: true, scheduledEndsAt: true },
            },
          },
        });
        if (!slot) {
          throw new AppointmentDomainError(
            "SLOT_UNAVAILABLE",
            "Slotul nu mai este disponibil. Alege alt interval.",
          );
        }
        const offering = slot.offerings.find((item) => item.id === input.offeringId);
        if (
          !offering ||
          offering.studentTreatment.deletedAt ||
          !offering.studentTreatment.treatment.isActive ||
          offering.supervisor.deletedAt
        ) {
          throw new AppointmentDomainError("SLOT_UNAVAILABLE", "Tratamentul nu mai este disponibil în acest interval.");
        }
        const generated = generateSmartBookingSlots([{
          id: slot.id,
          offeringId: offering.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          treatmentDurationMinutes: offering.studentTreatment.durationMinutes,
          offeredDurationsMinutes: slot.offerings
            .filter((item) => !item.studentTreatment.deletedAt && !item.supervisor.deletedAt)
            .map((item) => item.studentTreatment.durationMinutes),
          occupied: slot.appointments.map((appointment) => ({
            startsAt: appointment.scheduledStartsAt,
            endsAt: appointment.scheduledEndsAt,
          })),
        }]);
        const selected = generated.find(
          (candidate) =>
            candidate.offeringId === input.offeringId &&
            candidate.startsAt.getTime() === input.startsAt.getTime(),
        );
        if (!selected) {
          throw new AppointmentDomainError(
            "SLOT_UNAVAILABLE",
            "Ora nu mai este disponibilă. Alege alt interval din calendar.",
          );
        }
        const reviewRequired = await transaction.appointment.findFirst({
          where: {
            patientProfileId: patient.id,
            status: AppointmentStatus.COMPLETED,
            reviews: { none: { authorRole: AppointmentReviewAuthorRole.PATIENT } },
          },
          select: { routeSlug: true },
        });
        if (reviewRequired) {
          throw new AppointmentDomainError(
            "REVIEW_REQUIRED",
            "Lasă recenzia pentru programarea anterioară înainte de a trimite o cerere nouă.",
          );
        }
        const age = ageOnDate(patient.dateOfBirth!, selected.startsAt);
        if (age < 18 || age > 130) {
          throw new AppointmentDomainError(
            "PROFILE_REQUIRED",
            "Rezervările Universident sunt disponibile momentan persoanelor de minimum 18 ani.",
          );
        }
        const appointment = await transaction.appointment.create({
          data: {
            routeSlug: createAppointmentRouteSlug(
              offering.studentTreatment.treatment.name,
              selected.startsAt,
            ),
            patientProfileId: patient.id,
            studentProfileId: slot.studentProfileId,
            studentAvailabilitySlotId: slot.id,
            studentAvailabilitySlotOfferingId: offering.id,
            scheduledStartsAt: selected.startsAt,
            scheduledEndsAt: selected.endsAt,
            patientAgeAtAppointment: age,
            patientNote: input.patientNote,
            patientNameSnapshot: patientUser.name,
            studentNameSnapshot: slot.studentProfile.user.name,
            treatmentNameSnapshot: offering.studentTreatment.treatment.name,
            locationNameSnapshot: slot.studentLocation.name,
            locationAddressSnapshot: slot.studentLocation.address,
            supervisorNameSnapshot: [
              offering.supervisor.academicTitle,
              offering.supervisor.fullName,
            ].filter(Boolean).join(" "),
            statusChangedByUserId: patientUser.id,
            pendingExpiresAt: new Date(Math.min(
              now.getTime() + PENDING_REQUEST_LIFETIME_MS,
              selected.startsAt.getTime(),
            )),
            idempotencyKeyHash: hashes.keyHash,
            idempotencyRequestHash: hashes.requestHash,
          },
          include: appointmentInclude,
        });
        await createAppointmentNotifications(transaction, [
          {
            appointmentId: appointment.id,
            recipientUserId: slot.studentProfile.user.id,
            eventType: "REQUEST_CREATED",
            createdAt: now,
          },
        ]);
        return appointment;
      },
    );
  } catch (error) {
    if (isUniqueConflict(error) || isStudentActiveOverlap(error)) {
      if (isIdempotencyUniqueConflict(error)) {
        throw new AppointmentDomainError(
          "IDEMPOTENCY_CONFLICT",
          "Cheia cererii a fost deja folosită pentru altă programare.",
        );
      }
      throw new AppointmentDomainError(
        "SLOT_UNAVAILABLE",
        "Slotul nu mai este disponibil. Reîncarcă intervalele și încearcă din nou.",
      );
    }
    throw error;
  }
}

export async function listAppointmentsForUser(
  userId: string,
  role: UserRole,
) {
  const unreadNotifications = await prisma.appointmentNotification.findMany({
    where: { recipientUserId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      appointmentId: true,
    },
  });

  const unreadAppointmentIds = Array.from(
    new Set(unreadNotifications.map((notification) => notification.appointmentId)),
  );
  const unreadAppointments = unreadAppointmentIds.length
    ? await prisma.appointment.findMany({
        where: { id: { in: unreadAppointmentIds } },
        select: { routeSlug: true },
      })
    : [];
  const notificationData = {
    unreadNotificationCount: unreadNotifications.length,
    unreadNotificationIds: unreadNotifications.map(
      (notification) => notification.id,
    ),
    unreadAppointmentSlugs: unreadAppointments.map(
      (appointment) => appointment.routeSlug,
    ),
  };

  if (role === UserRole.PATIENT) {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true, profileSlug: true, dateOfBirth: true, bio: true },
    });
    if (!patient) {
      return {
        appointments: [],
        patientProfile: null,
        reputation: { lateCancellationsLast10: 0 },
        studentReputation: null,
        ...notificationData,
      };
    }
    const appointments = await prisma.appointment.findMany({
      where: { patientProfileId: patient.id },
      orderBy: { scheduledStartsAt: "desc" },
      include: privateAppointmentInclude(userId),
    });
    const recentConfirmedAppointments = await prisma.appointment.findMany({
      where: { patientProfileId: patient.id, confirmedAt: { not: null } },
      orderBy: { scheduledStartsAt: "desc" },
      take: 10,
      select: { isLateCancellation: true },
    });
    const lateCancellationsLast10 = recentConfirmedAppointments.filter(
      (appointment) => appointment.isLateCancellation,
    ).length;
    return {
      appointments,
      patientProfile: patient,
      reputation: { lateCancellationsLast10 },
      studentReputation: null,
      ...notificationData,
    };
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) {
    return {
      appointments: [],
      patientProfile: null,
      reputation: null,
      studentReputation: { cancellationsLast10: 0 },
      ...notificationData,
    };
  }
  const appointments = await prisma.appointment.findMany({
    where: { studentProfileId: student.id },
    orderBy: { scheduledStartsAt: "desc" },
    include: privateAppointmentInclude(userId),
  });
  const recentConfirmedAppointments = await prisma.appointment.findMany({
    where: { studentProfileId: student.id, confirmedAt: { not: null } },
    orderBy: { scheduledStartsAt: "desc" },
    take: 10,
    select: { status: true },
  });
    const cancellationsLast10 = recentConfirmedAppointments.filter(
      (appointment) =>
        appointment.status === AppointmentStatus.CANCELLED_BY_STUDENT,
    ).length;
    return {
      appointments,
      patientProfile: null,
      reputation: null,
      studentReputation: { cancellationsLast10 },
      ...notificationData,
    };
}

export async function getAppointmentForUser(
  routeSlug: string,
  userId: string,
  role: UserRole,
) {
  return prisma.appointment.findFirst({
    where: {
      routeSlug,
      ...(role === UserRole.PATIENT
        ? { patientProfile: { userId } }
        : { studentProfile: { userId } }),
    },
    include: privateAppointmentInclude(userId),
  });
}

export async function acknowledgeAppointmentNotifications(
  recipientUserId: string,
  notificationIds: string[],
) {
  if (notificationIds.length === 0) return { count: 0 };
  return prisma.appointmentNotification.deleteMany({
    where: appointmentNotificationAcknowledgementWhere(
      recipientUserId,
      notificationIds,
    ),
  });
}

export async function actOnAppointment(
  routeSlug: string,
  actor: { id: string; role: UserRole },
  input: Parsed<typeof parseAppointmentActionInput>,
) {
  try {
    return await runSerializableTransaction(
      prisma,
      async (transaction) => {
        await transaction.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
        await expirePendingAppointments(transaction);
        const appointment = await transaction.appointment.findUnique({
          where: { routeSlug },
          include: {
            patientProfile: true,
            studentProfile: true,
          },
        });
        if (!appointment) {
          throw new AppointmentDomainError("APPOINTMENT_NOT_FOUND", "Programarea nu a fost găsită.");
        }
        const isPatient = actor.role === UserRole.PATIENT && appointment.patientProfile.userId === actor.id;
        const isStudent = actor.role === UserRole.STUDENT && appointment.studentProfile.userId === actor.id;
        if (!isPatient && !isStudent) {
          throw new AppointmentDomainError("APPOINTMENT_NOT_FOUND", "Programarea nu a fost găsită.");
        }
        if (appointment.version !== input.expectedVersion) {
          throw new AppointmentDomainError("STALE_VERSION", "Programarea s-a modificat. Reîncarcă pagina.");
        }
        const now = new Date();
        const beforeStart = now < appointment.scheduledStartsAt;
        let status: AppointmentStatus;
        let data: Prisma.AppointmentUncheckedUpdateInput;

        if (input.action === "CONFIRM") {
          if (!isStudent || appointment.status !== AppointmentStatus.PENDING) {
            throw new AppointmentDomainError("ACTION_NOT_ALLOWED", "Cererea nu poate fi confirmată.");
          }
          if (!beforeStart) throw new AppointmentDomainError("ALREADY_STARTED", "Ora programării a trecut.");
          const unfinishedAppointment = await transaction.appointment.findFirst({
            where: {
              id: { not: appointment.id },
              studentProfileId: appointment.studentProfileId,
              OR: [
                {
                  status: AppointmentStatus.CONFIRMED,
                  scheduledEndsAt: { lte: now },
                },
                {
                  status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW] },
                  reviews: { none: { authorRole: AppointmentReviewAuthorRole.STUDENT } },
                },
              ],
            },
            select: { routeSlug: true },
          });
          if (unfinishedAppointment) {
            throw new AppointmentDomainError(
              "REVIEW_REQUIRED",
              "Închide programarea anterioară și lasă recenzia înainte de a accepta o cerere nouă.",
            );
          }
          const overlap = await transaction.appointment.findFirst({
            where: {
              id: { not: appointment.id },
              patientProfileId: appointment.patientProfileId,
              status: AppointmentStatus.CONFIRMED,
              scheduledStartsAt: { lt: appointment.scheduledEndsAt },
              scheduledEndsAt: { gt: appointment.scheduledStartsAt },
            },
            select: { id: true },
          });
          if (overlap) {
            throw new AppointmentDomainError(
              "PATIENT_TIME_CONFLICT",
              "Pacientul are deja o programare confirmată care se suprapune.",
            );
          }
          status = AppointmentStatus.CONFIRMED;
          data = { confirmedAt: now };
        } else if (input.action === "REJECT") {
          if (!isStudent || appointment.status !== AppointmentStatus.PENDING) {
            throw new AppointmentDomainError("ACTION_NOT_ALLOWED", "Cererea nu poate fi respinsă.");
          }
          status = AppointmentStatus.REJECTED;
          data = { rejectedAt: now, statusReason: input.reason, statusReasonCode: "STUDENT_REJECTED" };
        } else if (input.action === "CANCEL") {
          if (!beforeStart) {
            throw new AppointmentDomainError("ALREADY_STARTED", "După ora de început, studentul marchează rezultatul întâlnirii.");
          }
          if (appointment.status !== AppointmentStatus.PENDING && appointment.status !== AppointmentStatus.CONFIRMED) {
            throw new AppointmentDomainError("ACTION_NOT_ALLOWED", "Programarea nu mai poate fi anulată.");
          }
          if (isPatient) {
            status = AppointmentStatus.CANCELLED_BY_PATIENT;
            const late = appointment.status === AppointmentStatus.CONFIRMED &&
              appointment.scheduledStartsAt.getTime() - now.getTime() < 2 * 60 * 60 * 1000;
            data = { cancelledAt: now, statusReason: input.reason, statusReasonCode: "PATIENT_CANCELLED", isLateCancellation: late };
          } else {
            status = appointment.status === AppointmentStatus.PENDING
              ? AppointmentStatus.REJECTED
              : AppointmentStatus.CANCELLED_BY_STUDENT;
            data = {
              ...(status === AppointmentStatus.REJECTED ? { rejectedAt: now } : { cancelledAt: now }),
              statusReason: input.reason,
              statusReasonCode: status === AppointmentStatus.REJECTED ? "STUDENT_REJECTED" : "STUDENT_CANCELLED",
            };
          }
        } else {
          if (!isStudent || appointment.status !== AppointmentStatus.CONFIRMED) {
            throw new AppointmentDomainError("ACTION_NOT_ALLOWED", "Rezultatul nu poate fi înregistrat.");
          }
          if (now < appointment.scheduledEndsAt) {
            throw new AppointmentDomainError(
              "NOT_STARTED",
              "Rezultatul poate fi înregistrat după ora de final a programării.",
            );
          }
          status = input.action === "COMPLETE" ? AppointmentStatus.COMPLETED : AppointmentStatus.NO_SHOW;
          data = status === AppointmentStatus.COMPLETED ? { completedAt: now } : { noShowAt: now };
        }

        const updated = await transaction.appointment.update({
          where: { id: appointment.id, version: appointment.version },
          data: {
            ...data,
            status,
            statusChangedAt: now,
            statusChangedByUserId: actor.id,
            version: { increment: 1 },
          },
          include: appointmentInclude,
        });

        if (status !== AppointmentStatus.NO_SHOW) {
          await createAppointmentNotifications(transaction, [
            {
              appointmentId: appointment.id,
              recipientUserId: isPatient
                ? appointment.studentProfile.userId
                : appointment.patientProfile.userId,
              eventType: status,
              createdAt: now,
            },
          ]);
        }

        if (status === AppointmentStatus.COMPLETED || status === AppointmentStatus.NO_SHOW) {
          await transaction.appointmentReview.create({
            data: {
              appointmentId: appointment.id,
              authorUserId: actor.id,
              targetUserId: appointment.patientProfile.userId,
              authorRole: AppointmentReviewAuthorRole.STUDENT,
              rating: input.rating!,
              comment: input.comment,
              publishedAt: status === AppointmentStatus.NO_SHOW ? now : null,
            },
          });
          if (status === AppointmentStatus.COMPLETED) {
            await publishAppointmentReviews(transaction, appointment.id, now);
          }
        }

        if (status === AppointmentStatus.CONFIRMED) {
          const supersededCandidates = await transaction.appointment.findMany({
            where: {
              id: { not: appointment.id },
              patientProfileId: appointment.patientProfileId,
              status: AppointmentStatus.PENDING,
              scheduledStartsAt: { lt: appointment.scheduledEndsAt },
              scheduledEndsAt: { gt: appointment.scheduledStartsAt },
            },
            select: {
              id: true,
              studentProfile: { select: { userId: true } },
            },
          });
          const superseded = await transaction.appointment.updateManyAndReturn({
            where: {
              id: { in: supersededCandidates.map((candidate) => candidate.id) },
              status: AppointmentStatus.PENDING,
            },
            data: {
              status: AppointmentStatus.SUPERSEDED,
              statusReason: "O altă cerere suprapusă a pacientului a fost confirmată.",
              statusReasonCode: "OVERLAPPING_REQUEST_CONFIRMED",
              statusChangedAt: now,
              statusChangedByUserId: actor.id,
              version: { increment: 1 },
            },
            select: { id: true },
          });
          const supersededIds = new Set(superseded.map((item) => item.id));
          await createAppointmentNotifications(
            transaction,
            supersededCandidates
              .filter((candidate) => supersededIds.has(candidate.id))
              .flatMap((candidate) => [
                {
                  appointmentId: candidate.id,
                  recipientUserId: appointment.patientProfile.userId,
                  eventType: AppointmentStatus.SUPERSEDED,
                  createdAt: now,
                },
                ...(candidate.studentProfile.userId !== actor.id
                  ? [
                      {
                        appointmentId: candidate.id,
                        recipientUserId: candidate.studentProfile.userId,
                        eventType: AppointmentStatus.SUPERSEDED,
                        createdAt: now,
                      },
                    ]
                  : []),
              ]),
          );
        }
        if (status !== AppointmentStatus.COMPLETED && status !== AppointmentStatus.NO_SHOW) {
          return updated;
        }
        return transaction.appointment.findUniqueOrThrow({
          where: { id: appointment.id },
          include: appointmentInclude,
        });
      },
    );
  } catch (error) {
    if (isPatientOverlap(error)) {
      throw new AppointmentDomainError(
        "PATIENT_TIME_CONFLICT",
        "Pacientul are deja o programare confirmată care se suprapune.",
      );
    }
    throw error;
  }
}

export async function reviewAppointment(
  routeSlug: string,
  actor: { id: string; role: UserRole },
  input: Parsed<typeof parseAppointmentReviewInput>,
) {
  try {
    return await runSerializableTransaction(
      prisma,
      async (transaction) => {
        await expirePendingAppointments(transaction);
        const appointment = await transaction.appointment.findUnique({
          where: { routeSlug },
          include: { patientProfile: true, studentProfile: true },
        });
        if (!appointment) {
          throw new AppointmentDomainError("APPOINTMENT_NOT_FOUND", "Programarea nu a fost găsită.");
        }
        const isPatient = actor.role === UserRole.PATIENT && appointment.patientProfile.userId === actor.id;
        const isStudent = actor.role === UserRole.STUDENT && appointment.studentProfile.userId === actor.id;
        if (!isPatient && !isStudent) {
          throw new AppointmentDomainError("APPOINTMENT_NOT_FOUND", "Programarea nu a fost găsită.");
        }
        const reviewerRole = isPatient ? "PATIENT" : "STUDENT";
        if (!appointmentReviewIsAllowed(appointment.status, reviewerRole)) {
          throw new AppointmentDomainError(
            "REVIEW_NOT_AVAILABLE",
            appointment.status === AppointmentStatus.NO_SHOW && isPatient
              ? "Nu poți evalua studentul pentru o programare la care nu te-ai prezentat."
              : "Recenzia poate fi trimisă după ce studentul închide programarea.",
          );
        }
        const authorRole = reviewerRole === "PATIENT"
          ? AppointmentReviewAuthorRole.PATIENT
          : AppointmentReviewAuthorRole.STUDENT;
        const targetUserId = isPatient
          ? appointment.studentProfile.userId
          : appointment.patientProfile.userId;
        const now = new Date();
        const review = await transaction.appointmentReview.create({
          data: {
            appointmentId: appointment.id,
            authorUserId: actor.id,
            targetUserId,
            authorRole,
            rating: input.rating,
            comment: input.comment,
          },
        });
        await publishAppointmentReviews(transaction, appointment.id, now);
        return review;
      },
    );
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppointmentDomainError(
        "REVIEW_ALREADY_SUBMITTED",
        "Ai trimis deja recenzia pentru această programare.",
      );
    }
    throw error;
  }
}
