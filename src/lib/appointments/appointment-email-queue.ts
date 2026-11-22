import type { Prisma } from "@/generated/prisma/client";
import type { AppointmentEmailKind } from "@/generated/prisma/enums";

export async function queueAppointmentEmails(
  transaction: Prisma.TransactionClient,
  appointmentId: string,
  emails: ReadonlyArray<{ kind: AppointmentEmailKind; dueAt: Date }>,
) {
  await transaction.appointmentEmail.createMany({
    data: emails.map((email) => ({ appointmentId, ...email })),
    skipDuplicates: true,
  });
}
