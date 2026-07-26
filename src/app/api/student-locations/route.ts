import type { Prisma } from "@/generated/prisma/client";
import { authorizeStudentLocationRequest } from "@/lib/student-locations/student-location-request";
import { parseCreateStudentLocationInput } from "@/lib/student-locations/student-location-input";
import { prisma } from "@/lib/prisma";
import { studentLocationSelect } from "@/lib/student-locations/student-location-data";
import {
  createStudentLocationRouteKey,
  isStudentLocationRouteKeyCollision,
} from "@/lib/student-locations/student-location-route-key";

function unexpectedError(error: unknown) {
  console.error("Student location API error:", error);

  return Response.json(
    { error: "Locațiile nu au putut fi procesate." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const authorization =
      await authorizeStudentLocationRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const locations = await prisma.studentLocation.findMany({
      where: {
        studentProfileId: authorization.studentProfileId,
        deletedAt: null,
      },
      orderBy: [
        {
          isActive: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: studentLocationSelect,
    });

    return Response.json({
      locations,
    });
  } catch (error) {
    return unexpectedError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authorization =
      await authorizeStudentLocationRequest(request, {
        verifyOrigin: true,
      });

    if (!authorization.ok) {
      return authorization.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Datele trimise nu sunt valide." },
        { status: 400 },
      );
    }

    const parsedInput = parseCreateStudentLocationInput(body);

    if (!parsedInput.ok) {
      return Response.json(
        { error: parsedInput.error },
        { status: 400 },
      );
    }

    const city = await prisma.city.findFirst({
      where: {
        id: parsedInput.data.cityId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!city) {
      return Response.json(
        {
          error:
            "Orașul selectat nu există sau nu este disponibil.",
        },
        { status: 400 },
      );
    }

    const maximumRouteKeyAttempts = 5;
    let location:
      | Prisma.StudentLocationGetPayload<{
          select: typeof studentLocationSelect;
        }>
      | undefined;

    for (
      let attempt = 0;
      attempt < maximumRouteKeyAttempts;
      attempt += 1
    ) {
      try {
        location = await prisma.studentLocation.create({
          data: {
            studentProfileId: authorization.studentProfileId,
            routeKey: createStudentLocationRouteKey(),
            ...parsedInput.data,
          },
          select: studentLocationSelect,
        });
        break;
      } catch (error) {
        if (!isStudentLocationRouteKeyCollision(error)) {
          throw error;
        }
      }
    }

    if (!location) {
      return Response.json(
        {
          error:
            "Locația nu a putut fi creată. Încearcă din nou.",
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        location,
      },
      { status: 201 },
    );
  } catch (error) {
    return unexpectedError(error);
  }
}
