import type { Prisma } from "@/generated/prisma/client";

export function appointmentNotificationAcknowledgementWhere(
  recipientUserId: string,
  notificationIds: string[],
): Prisma.AppointmentNotificationWhereInput {
  return {
    recipientUserId,
    id: { in: Array.from(new Set(notificationIds)) },
  };
}
