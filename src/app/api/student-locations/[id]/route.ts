import { prisma } from "@/lib/prisma";
import {
  findTreatmentsAffectedByLocationChange,
  type AffectedStudentTreatment,
} from "@/lib/student-locations/student-location-cascade";
import { studentLocationSelect } from "@/lib/student-locations/student-location-data";
import {
  parseArchiveStudentLocationInput,
  parseUpdateStudentLocationInput,
  type UpdateStudentLocationData,
} from "@/lib/student-locations/student-location-input";
import { authorizeStudentLocationRequest } from "@/lib/student-locations/student-location-request";

type StudentLocationRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

class LocationNotFoundError extends Error {}

class ArchivedLocationError extends Error {}

class CascadeConfirmationRequiredError extends Error {
  constructor(
    readonly affectedTreatments: AffectedStudentTreatment[],
  ) {
    super("Cascade confirmation required");
  }
}

function cascadeConflictResponse(
  affectedTreatments: AffectedStudentTreatment[],
) {
  return Response.json(
    {
      error:
        "Această operație va dezactiva și tratamentele care nu mai au nicio altă locație activă.",
      requiresConfirmation: true,
      affectedTreatmentCount: affectedTreatments.length,
      affectedTreatments,
    },
    { status: 409 },
  );
}

function routeErrorResponse(error: unknown) {
  if (error instanceof LocationNotFoundError) {
    return Response.json(
      { error: "Locația nu a fost găsită." },
      { status: 404 },
    );
  }

  if (error instanceof ArchivedLocationError) {
    return Response.json(
      {
        error:
          "Locația este arhivată și nu mai poate fi modificată.",
      },
      { status: 409 },
    );
  }

  if (error instanceof CascadeConfirmationRequiredError) {
    return cascadeConflictResponse(error.affectedTreatments);
  }

  console.error("Student location mutation error:", error);

  return Response.json(
    { error: "Locația nu a putut fi actualizată." },
    { status: 500 },
  );
}

async function parseRequiredJsonBody(
  request: Request,
): Promise<
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  try {
    return {
      ok: true,
      body: await request.json(),
    };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Datele trimise nu sunt valide." },
        { status: 400 },
      ),
    };
  }
}

async function parseOptionalJsonBody(
  request: Request,
): Promise<
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const bodyText = await request.text();

  if (!bodyText.trim()) {
    return {
      ok: true,
      body: {},
    };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(bodyText) as unknown,
    };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Datele trimise nu sunt valide." },
        { status: 400 },
      ),
    };
  }
}

async function ensureActiveCityExists(cityId: string) {
  return prisma.city.findFirst({
    where: {
      id: cityId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
}

async function updateLocationTransactionally({
  studentProfileId,
  studentLocationId,
  data,
  confirmCascade,
}: {
  studentProfileId: string;
  studentLocationId: string;
  data: UpdateStudentLocationData;
  confirmCascade: boolean;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const existingLocation =
        await transaction.studentLocation.findFirst({
          where: {
            id: studentLocationId,
            studentProfileId,
          },
          select: {
            isActive: true,
            deletedAt: true,
          },
        });

      if (!existingLocation) {
        throw new LocationNotFoundError();
      }

      if (existingLocation.deletedAt) {
        throw new ArchivedLocationError();
      }

      const isBeingDeactivated =
        existingLocation.isActive && data.isActive === false;

      const affectedTreatments = isBeingDeactivated
        ? await findTreatmentsAffectedByLocationChange(
            transaction,
            studentProfileId,
            studentLocationId,
          )
        : [];

      if (affectedTreatments.length > 0 && !confirmCascade) {
        throw new CascadeConfirmationRequiredError(
          affectedTreatments,
        );
      }

      const location = await transaction.studentLocation.update({
        where: {
          id: studentLocationId,
        },
        data,
        select: studentLocationSelect,
      });

      if (affectedTreatments.length > 0) {
        await transaction.studentTreatment.updateMany({
          where: {
            id: {
              in: affectedTreatments.map(
                (studentTreatment) => studentTreatment.id,
              ),
            },
            studentProfileId,
            isActive: true,
            deletedAt: null,
          },
          data: {
            isActive: false,
          },
        });
      }

      return {
        location,
        affectedTreatments,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}

export async function PATCH(
  request: Request,
  context: StudentLocationRouteContext,
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
      return Response.json(
        { error: "Locația nu a fost găsită." },
        { status: 404 },
      );
    }

    const parsedBody = await parseRequiredJsonBody(request);

    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsedInput = parseUpdateStudentLocationInput(
      parsedBody.body,
    );

    if (!parsedInput.ok) {
      return Response.json(
        { error: parsedInput.error },
        { status: 400 },
      );
    }

    if (parsedInput.data.data.cityId) {
      const city = await ensureActiveCityExists(
        parsedInput.data.data.cityId,
      );

      if (!city) {
        return Response.json(
          {
            error:
              "Orașul selectat nu există sau nu este disponibil.",
          },
          { status: 400 },
        );
      }
    }

    const result = await updateLocationTransactionally({
      studentProfileId: authorization.studentProfileId,
      studentLocationId: id,
      data: parsedInput.data.data,
      confirmCascade: parsedInput.data.confirmCascade,
    });

    return Response.json({
      location: result.location,
      deactivatedTreatmentCount:
        result.affectedTreatments.length,
      deactivatedTreatments: result.affectedTreatments,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: StudentLocationRouteContext,
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
      return Response.json(
        { error: "Locația nu a fost găsită." },
        { status: 404 },
      );
    }

    const parsedBody = await parseOptionalJsonBody(request);

    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsedInput = parseArchiveStudentLocationInput(
      parsedBody.body,
    );

    if (!parsedInput.ok) {
      return Response.json(
        { error: parsedInput.error },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const existingLocation =
          await transaction.studentLocation.findFirst({
            where: {
              id,
              studentProfileId:
                authorization.studentProfileId,
            },
            select: {
              deletedAt: true,
            },
          });

        if (!existingLocation) {
          throw new LocationNotFoundError();
        }

        if (existingLocation.deletedAt) {
          throw new ArchivedLocationError();
        }

        const affectedTreatments =
          await findTreatmentsAffectedByLocationChange(
            transaction,
            authorization.studentProfileId,
            id,
          );

        if (
          affectedTreatments.length > 0 &&
          !parsedInput.data.confirmCascade
        ) {
          throw new CascadeConfirmationRequiredError(
            affectedTreatments,
          );
        }

        const archivedAt = new Date();

        await transaction.studentLocation.update({
          where: {
            id,
          },
          data: {
            isActive: false,
            deletedAt: archivedAt,
          },
        });

        await transaction.studentTreatmentLocation.updateMany({
          where: {
            studentProfileId:
              authorization.studentProfileId,
            studentLocationId: id,
            deletedAt: null,
          },
          data: {
            isActive: false,
            deletedAt: archivedAt,
          },
        });

        if (affectedTreatments.length > 0) {
          await transaction.studentTreatment.updateMany({
            where: {
              id: {
                in: affectedTreatments.map(
                  (studentTreatment) =>
                    studentTreatment.id,
                ),
              },
              studentProfileId:
                authorization.studentProfileId,
              isActive: true,
              deletedAt: null,
            },
            data: {
              isActive: false,
            },
          });
        }

        return {
          archivedAt,
          affectedTreatments,
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );

    return Response.json({
      archivedLocationId: id,
      archivedAt: result.archivedAt,
      deactivatedTreatmentCount:
        result.affectedTreatments.length,
      deactivatedTreatments: result.affectedTreatments,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
