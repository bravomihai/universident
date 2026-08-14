import { prisma } from "@/lib/prisma";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";

type StudentTreatmentRestoreRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

class TreatmentNotFoundError extends Error {}

class TreatmentNotArchivedError extends Error {}

function restoreErrorResponse(error: unknown) {
  if (error instanceof TreatmentNotFoundError) {
    return Response.json(
      { error: "Tratamentul nu a fost găsit." },
      { status: 404 },
    );
  }

  if (error instanceof TreatmentNotArchivedError) {
    return Response.json(
      { error: "Tratamentul nu este arhivat." },
      { status: 409 },
    );
  }

  console.error("Student treatment restore error:", error);

  return Response.json(
    { error: "Tratamentul nu a putut fi restaurat." },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: StudentTreatmentRestoreRouteContext,
) {
  try {
    const authorization =
      await authorizeStudentTreatmentRequest(request, {
        verifyOrigin: true,
      });

    if (!authorization.ok) {
      return authorization.response;
    }

    const { id } = await context.params;

    if (!id) {
      throw new TreatmentNotFoundError();
    }

    const parsedBody = await parseEmptyJsonRequestBody(request);

    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const restoredTreatment = await prisma.$transaction(
      async (transaction) => {
        const existingTreatment =
          await transaction.studentTreatment.findFirst({
            where: {
              id,
              studentProfileId: authorization.studentProfileId,
            },
            select: {
              deletedAt: true,
            },
          });

        if (!existingTreatment) {
          throw new TreatmentNotFoundError();
        }

        if (!existingTreatment.deletedAt) {
          throw new TreatmentNotArchivedError();
        }

        const treatment =
          await transaction.studentTreatment.update({
            where: {
              id,
            },
            data: {
              deletedAt: null,
            },
            select: {
              id: true,
              treatment: {
                select: {
                  name: true,
                },
              },
            },
          });

        return {
          id: treatment.id,
          name: treatment.treatment.name,
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );

    return Response.json({
      restoredTreatment,
      message: "Tratamentul a fost restaurat.",
    });
  } catch (error) {
    return restoreErrorResponse(error);
  }
}
