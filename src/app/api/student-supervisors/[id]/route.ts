import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";
import { studentSupervisorSelect } from "@/lib/student-supervisors/student-supervisor-data";
import { parseUpdateStudentSupervisorInput } from "@/lib/student-supervisors/student-supervisor-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";

type RouteContext = { params: Promise<{ id: string }> };

class SupervisorNotFoundError extends Error {}
class SupervisorInUseError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof SupervisorNotFoundError) {
    return Response.json({ error: "Profesorul nu a fost găsit." }, { status: 404 });
  }

  if (error instanceof SupervisorInUseError) {
    return Response.json(
      {
        error:
          "Profesorul este folosit de asocieri active. Realocă mai întâi acele locații.",
      },
      { status: 409 },
    );
  }

  console.error("Student supervisor mutation error:", error);
  return Response.json(
    { error: "Profesorul nu a putut fi actualizat." },
    { status: 500 },
  );
}

async function hasActiveAssociations(
  transaction: Prisma.TransactionClient,
  studentProfileId: string,
  supervisorId: string,
) {
  return (
    (await transaction.studentTreatmentLocation.count({
      where: {
        studentProfileId,
        supervisorId,
        isActive: true,
        deletedAt: null,
      },
    })) > 0
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeStudentTreatmentRequest(request, {
      verifyOrigin: true,
    });
    if (!authorization.ok) return authorization.response;

    const { id } = await context.params;
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Datele trimise nu sunt valide." },
        { status: 400 },
      );
    }

    const parsedInput = parseUpdateStudentSupervisorInput(body);
    if (!parsedInput.ok) {
      return Response.json({ error: parsedInput.error }, { status: 400 });
    }

    const supervisor = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.studentSupervisor.findFirst({
          where: {
            id,
            studentProfileId: authorization.studentProfileId,
            deletedAt: null,
          },
          select: { id: true, isActive: true },
        });

        if (!existing) throw new SupervisorNotFoundError();

        if (
          existing.isActive &&
          parsedInput.data.isActive === false &&
          (await hasActiveAssociations(
            transaction,
            authorization.studentProfileId,
            id,
          ))
        ) {
          throw new SupervisorInUseError();
        }

        return transaction.studentSupervisor.update({
          where: { id },
          data: parsedInput.data,
          select: studentSupervisorSelect,
        });
      },
      { isolationLevel: "Serializable" },
    );

    return Response.json({ supervisor });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeStudentTreatmentRequest(request, {
      verifyOrigin: true,
    });
    if (!authorization.ok) return authorization.response;

    const parsedBody = await parseEmptyJsonRequestBody(request);
    if (!parsedBody.ok) return parsedBody.response;

    const { id } = await context.params;

    const archivedAt = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.studentSupervisor.findFirst({
          where: { id, studentProfileId: authorization.studentProfileId },
          select: { id: true, deletedAt: true },
        });

        if (!existing || existing.deletedAt) {
          throw new SupervisorNotFoundError();
        }

        if (
          await hasActiveAssociations(
            transaction,
            authorization.studentProfileId,
            id,
          )
        ) {
          throw new SupervisorInUseError();
        }

        const timestamp = new Date();
        await transaction.studentSupervisor.update({
          where: { id },
          data: { isActive: false, deletedAt: timestamp },
        });
        return timestamp;
      },
      { isolationLevel: "Serializable" },
    );

    return Response.json({ archivedSupervisorId: id, archivedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
