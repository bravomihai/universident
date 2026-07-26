import { prisma } from "@/lib/prisma";
import { authorizeStudentLocationRequest } from "@/lib/student-locations/student-location-request";
import { parseEmptyJsonRequestBody } from "@/lib/student/empty-json-request-body";

type StudentLocationRestoreRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

class LocationNotFoundError extends Error {}

class LocationNotArchivedError extends Error {}

function restoreErrorResponse(error: unknown) {
  if (error instanceof LocationNotFoundError) {
    return Response.json(
      { error: "Locația nu a fost găsită." },
      { status: 404 },
    );
  }

  if (error instanceof LocationNotArchivedError) {
    return Response.json(
      { error: "Locația nu este arhivată." },
      { status: 409 },
    );
  }

  console.error("Student location restore error:", error);

  return Response.json(
    { error: "Locația nu a putut fi restaurată." },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: StudentLocationRestoreRouteContext,
) {
  try {
    const authorization =
      await authorizeStudentLocationRequest(request, {
        verifyOrigin: true,
      });

    if (!authorization.ok) {
      return authorization.response;
    }

    const { id } = await context.params;

    if (!id) {
      throw new LocationNotFoundError();
    }

    const parsedBody = await parseEmptyJsonRequestBody(request);

    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const restoredLocation = await prisma.$transaction(
      async (transaction) => {
        const existingLocation =
          await transaction.studentLocation.findFirst({
            where: {
              id,
              studentProfileId: authorization.studentProfileId,
            },
            select: {
              deletedAt: true,
            },
          });

        if (!existingLocation) {
          throw new LocationNotFoundError();
        }

        if (!existingLocation.deletedAt) {
          throw new LocationNotArchivedError();
        }

        return transaction.studentLocation.update({
          where: {
            id,
          },
          data: {
            deletedAt: null,
            isActive: false,
          },
          select: {
            id: true,
            routeKey: true,
            name: true,
            isActive: true,
          },
        });
      },
      {
        isolationLevel: "Serializable",
      },
    );

    return Response.json({
      restoredLocation,
      message: "Locația a fost restaurată ca inactivă.",
    });
  } catch (error) {
    return restoreErrorResponse(error);
  }
}
