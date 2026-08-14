import type { Prisma } from "@/generated/prisma/client";
import { AppointmentStatus, UserRole } from "@/generated/prisma/enums";
import type {
  parseAppointmentActionInput,
  parseCreateAppointmentInput,
} from "@/lib/appointments/appointment-input";
import {
  createAppointmentRouteSlug,
  createPatientProfileSlug,
} from "@/lib/appointments/appointment-route-slug";
import { ageOnDate } from "@/lib/availability/bucharest-time";
import { parsePatientProfileInput } from "@/lib/patient/patient-profile-input";
import { prisma } from "@/lib/prisma";

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
  | "STALE_VERSION";

export class AppointmentDomainError extends Error {
  constructor(
    readonly code: AppointmentDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const appointmentInclude = {
  patientProfile: {
    select: { id: true, user: { select: { id: true, name: true } } },
  },
  studentProfile: {
    select: {
      id: true,
      publicSlug: true,
      university: true,
      studyYear: true,
      user: { select: { id: true, name: true } },
    },
  },
  availabilitySlot: {
    include: {
      treatmentLocation: {
        include: {
          studentTreatment: { include: { treatment: true } },
          studentLocation: { include: { city: true } },
          supervisor: true,
        },
      },
    },
  },
} satisfies Prisma.AppointmentInclude;

export async function expirePendingAppointments(
  transaction: Prisma.TransactionClient,
  now = new Date(),
) {
  return transaction.appointment.updateMany({
    where: {
      status: AppointmentStatus.PENDING,
      scheduledStartsAt: { lte: now },
    },
    data: {
      status: AppointmentStatus.EXPIRED,
      statusReason: "Cererea a expirat la ora programată înainte de confirmare.",
      statusReasonCode: "START_REACHED",
      statusChangedAt: now,
      expiredAt: now,
      version: { increment: 1 },
    },
  });
}

async function getOrCreatePatientProfile(
  transaction: Prisma.TransactionClient,
  user: { id: string; name: string },
  dateOfBirthInput: string | null,
) {
  let profile = await transaction.patientProfile.findUnique({
    where: { userId: user.id },
  });
  if (dateOfBirthInput) {
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

function isPatientOverlap(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  return message.includes("appointment_patient_confirmed_time_excl");
}

export async function createAppointmentRequest(
  patientUser: { id: string; name: string },
  studentSlug: string,
  input: Parsed<typeof parseCreateAppointmentInput>,
) {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        await expirePendingAppointments(transaction);
        const slot = await transaction.studentAvailabilitySlot.findFirst({
          where: {
            id: input.slotId,
            status: "ACTIVE",
            startsAt: { gt: new Date() },
            studentProfile: { publicSlug: studentSlug, isPublished: true },
            treatmentLocation: {
              isActive: true,
              deletedAt: null,
              studentTreatment: { isActive: true, deletedAt: null },
              studentLocation: { isActive: true, deletedAt: null },
              supervisor: { isActive: true, deletedAt: null },
            },
            appointments: {
              none: { status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } },
            },
          },
          include: {
            studentProfile: { include: { user: true } },
            treatmentLocation: {
              include: {
                studentTreatment: { include: { treatment: true } },
                studentLocation: true,
                supervisor: true,
              },
            },
          },
        });
        if (!slot) {
          throw new AppointmentDomainError(
            "SLOT_UNAVAILABLE",
            "Slotul nu mai este disponibil. Alege alt interval.",
          );
        }
        const patient = await getOrCreatePatientProfile(
          transaction,
          patientUser,
          input.dateOfBirth,
        );
        const age = ageOnDate(patient.dateOfBirth!, slot.startsAt);
        if (age < 18 || age > 130) {
          throw new AppointmentDomainError(
            "PROFILE_REQUIRED",
            "Rezervările Universident sunt disponibile momentan persoanelor de minimum 18 ani.",
          );
        }
        const association = slot.treatmentLocation;
        return transaction.appointment.create({
          data: {
            routeSlug: createAppointmentRouteSlug(
              association.studentTreatment.treatment.name,
              slot.startsAt,
            ),
            patientProfileId: patient.id,
            studentProfileId: slot.studentProfileId,
            studentAvailabilitySlotId: slot.id,
            scheduledStartsAt: slot.startsAt,
            scheduledEndsAt: slot.endsAt,
            patientAgeAtAppointment: age,
            patientNote: input.patientNote,
            patientNameSnapshot: patientUser.name,
            studentNameSnapshot: slot.studentProfile.user.name,
            treatmentNameSnapshot: association.studentTreatment.treatment.name,
            locationNameSnapshot: association.studentLocation.name,
            locationAddressSnapshot: association.studentLocation.address,
            supervisorNameSnapshot: [
              association.supervisor.academicTitle,
              association.supervisor.fullName,
            ].filter(Boolean).join(" "),
            statusChangedByUserId: patientUser.id,
          },
          include: appointmentInclude,
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppointmentDomainError(
        "SLOT_UNAVAILABLE",
        "Alt pacient a trimis deja o cerere pentru acest slot.",
      );
    }
    throw error;
  }
}

export async function listAppointmentsForUser(userId: string, role: UserRole) {
  return prisma.$transaction(async (transaction) => {
    await expirePendingAppointments(transaction);
    if (role === UserRole.PATIENT) {
      const patient = await transaction.patientProfile.findUnique({
        where: { userId },
        select: { id: true, profileSlug: true, dateOfBirth: true },
      });
      if (!patient) return { appointments: [], patientProfile: null, reputation: { lateCancellations12Months: 0, lateCancellationsLifetime: 0 } };
      const rollingStart = new Date();
      rollingStart.setUTCFullYear(rollingStart.getUTCFullYear() - 1);
      const [appointments, lateCancellations12Months, lateCancellationsLifetime] = await Promise.all([
        transaction.appointment.findMany({
          where: { patientProfileId: patient.id },
          orderBy: { scheduledStartsAt: "desc" },
          include: appointmentInclude,
        }),
        transaction.appointment.count({
          where: { patientProfileId: patient.id, isLateCancellation: true, cancelledAt: { gte: rollingStart } },
        }),
        transaction.appointment.count({
          where: { patientProfileId: patient.id, isLateCancellation: true },
        }),
      ]);
      return { appointments, patientProfile: patient, reputation: { lateCancellations12Months, lateCancellationsLifetime } };
    }
    const student = await transaction.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return { appointments: [], patientProfile: null, reputation: null };
    const appointments = await transaction.appointment.findMany({
      where: { studentProfileId: student.id },
      orderBy: { scheduledStartsAt: "desc" },
      include: appointmentInclude,
    });
    return { appointments, patientProfile: null, reputation: null };
  });
}

export async function getAppointmentForUser(
  routeSlug: string,
  userId: string,
  role: UserRole,
) {
  await prisma.$transaction((transaction) => expirePendingAppointments(transaction));
  return prisma.appointment.findFirst({
    where: {
      routeSlug,
      ...(role === UserRole.PATIENT
        ? { patientProfile: { userId } }
        : { studentProfile: { userId } }),
    },
    include: appointmentInclude,
  });
}

export async function actOnAppointment(
  routeSlug: string,
  actor: { id: string; role: UserRole },
  input: Parsed<typeof parseAppointmentActionInput>,
) {
  try {
    return await prisma.$transaction(
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
          if (beforeStart) throw new AppointmentDomainError("NOT_STARTED", "Rezultatul poate fi înregistrat după ora de început.");
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

        if (status === AppointmentStatus.CONFIRMED) {
          await transaction.appointment.updateMany({
            where: {
              id: { not: appointment.id },
              patientProfileId: appointment.patientProfileId,
              status: AppointmentStatus.PENDING,
              scheduledStartsAt: { lt: appointment.scheduledEndsAt },
              scheduledEndsAt: { gt: appointment.scheduledStartsAt },
            },
            data: {
              status: AppointmentStatus.SUPERSEDED,
              statusReason: "O altă cerere suprapusă a pacientului a fost confirmată.",
              statusReasonCode: "OVERLAPPING_REQUEST_CONFIRMED",
              statusChangedAt: now,
              statusChangedByUserId: actor.id,
              version: { increment: 1 },
            },
          });
        }
        return updated;
      },
      { isolationLevel: "Serializable" },
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
