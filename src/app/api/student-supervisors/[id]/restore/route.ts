import { prisma } from "@/lib/prisma";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";
import { studentSupervisorSelect } from "@/lib/student-supervisors/student-supervisor-data";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";

type RouteContext = { params: Promise<{ id: string }> };

class SupervisorNotFoundError extends Error {}
class SupervisorNotArchivedError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof SupervisorNotFoundError) {
    return Response.json(
      { error: "Profesorul supervizor nu a fost găsit." },
      { status: 404 },
    );
  }

  if (error instanceof SupervisorNotArchivedError) {
    return Response.json(
      { error: "Profesorul supervizor nu este arhivat." },
      { status: 409 },
    );
  }

  console.error("Student supervisor restore error:", error);
  return Response.json(
    { error: "Profesorul supervizor nu a putut fi restaurat." },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeStudentTreatmentRequest(request, {
      verifyOrigin: true,
    });
    if (!authorization.ok) return authorization.response;

    const parsedBody = await parseEmptyJsonRequestBody(request);
    if (!parsedBody.ok) return parsedBody.response;

    const { id } = await context.params;
    if (!id) throw new SupervisorNotFoundError();

    const restoredSupervisor = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.studentSupervisor.findFirst({
          where: {
            id,
            studentProfileId: authorization.studentProfileId,
          },
          select: { deletedAt: true },
        });

        if (!existing) throw new SupervisorNotFoundError();
        if (!existing.deletedAt) throw new SupervisorNotArchivedError();

        return transaction.studentSupervisor.update({
          where: { id },
          data: { deletedAt: null },
          select: studentSupervisorSelect,
        });
      },
      { isolationLevel: "Serializable" },
    );

    return Response.json({
      restoredSupervisor,
      message: "Profesorul supervizor a fost restaurat.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
