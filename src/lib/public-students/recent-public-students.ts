import "server-only";

import { UserRole } from "@/generated/prisma/enums";
import { appointmentConsumesCapacityWhere } from "@/lib/appointments/appointment-service";
import { ensureStudentSeriesMaterializedThrough } from "@/lib/availability/materializer";
import { publicBookingWindowEnd } from "@/lib/availability/public-booking-window";
import { prisma } from "@/lib/prisma";
import { summarizeRecentStudentAvailability } from "./recent-student-availability";
import { createRecentPublicStudent, type RecentPublicStudent } from "./recent-public-student-dto";

const RECENT_PUBLIC_STUDENT_LIMIT = 8;

export async function getRecentPublicStudents(excludedUserId?: string) {
  const now = new Date();
  const through = publicBookingWindowEnd(now);
  const result: RecentPublicStudent[] = [];
  let cursor: string | undefined;
  const publicWhere = {
    isPublished: true,
    publicSlug: { not: null },
    university: { not: "" },
    studyYear: { gte: 1, lte: 6 },
    lastRefreshedAt: { not: null },
    user: { role: UserRole.STUDENT, emailVerified: true },
    ...(excludedUserId ? { userId: { not: excludedUserId } } : {}),
  } as const;

  // Page through recently refreshed profiles; a full calendar does not hide the
  // next eligible student. No patient or authentication fields reach the DTO.
  while (result.length < RECENT_PUBLIC_STUDENT_LIMIT) {
    const profiles = await prisma.studentProfile.findMany({
      where: publicWhere,
      orderBy: [{ lastRefreshedAt: "desc" }, { id: "asc" }],
      take: 8,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, publicSlug: true, university: true, studyYear: true,
        lastRefreshedAt: true,
        profileImage: { select: { id: true, updatedAt: true } },
        user: { select: { name: true } },
      },
    });
    if (!profiles.length) break;
    await Promise.all(profiles.map((profile) => ensureStudentSeriesMaterializedThrough(profile.id, through, now)));
    const blocks = await prisma.studentAvailabilitySlot.findMany({
      where: {
        studentProfileId: { in: profiles.map((profile) => profile.id) },
        studentProfile: publicWhere,
        status: "ACTIVE",
        OR: [{ seriesId: null }, { series: { status: "ACTIVE" } }],
        startsAt: { lt: through },
        endsAt: { gt: now },
        studentLocation: { deletedAt: null, city: { isActive: true } },
      },
      select: {
        id: true, studentProfileId: true, startsAt: true, endsAt: true,
        studentLocation: { select: { city: { select: { name: true } } } },
        offerings: {
          where: { removedAt: null, studentTreatment: { deletedAt: null, treatment: { isActive: true } }, supervisor: { deletedAt: null } },
          select: { id: true, studentTreatment: { select: { durationMinutes: true, treatment: { select: { name: true } } } } },
        },
        appointments: {
          where: appointmentConsumesCapacityWhere(now),
          select: { scheduledStartsAt: true, scheduledEndsAt: true },
        },
      },
    });
    const summaries = summarizeRecentStudentAvailability(blocks.map((block) => ({
      id: block.id, studentProfileId: block.studentProfileId,
      startsAt: block.startsAt, endsAt: block.endsAt,
      cityName: block.studentLocation.city.name,
      offerings: block.offerings.map((offering) => ({
        id: offering.id,
        durationMinutes: offering.studentTreatment.durationMinutes,
        treatmentName: offering.studentTreatment.treatment.name,
      })),
      occupied: block.appointments.map((appointment) => ({ startsAt: appointment.scheduledStartsAt, endsAt: appointment.scheduledEndsAt })),
    })), now);
    for (const profile of profiles) {
      const summary = summaries.get(profile.id);
      if (!summary) continue;
      const student = createRecentPublicStudent(profile, summary);
      if (!student) continue;
      result.push(student);
      if (result.length === RECENT_PUBLIC_STUDENT_LIMIT) break;
    }
    if (profiles.length < 8) break;
    cursor = profiles[profiles.length - 1].id;
  }
  return result;
}
