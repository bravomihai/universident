import { prisma } from "@/lib/prisma";
import { studentTreatmentSelect } from "@/lib/student-treatments/student-treatment-data";
import { parseCreateStudentTreatmentInput } from "@/lib/student-treatments/student-treatment-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";
import {
  createStudentTreatment,
  StudentTreatmentDomainError,
} from "@/lib/student-treatments/student-treatment-service";

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function treatmentErrorResponse(error: unknown) {
  if (error instanceof StudentTreatmentDomainError) {
    const status =
      error.code === "TREATMENT_ALREADY_ADDED" ||
      error.code === "TREATMENT_ARCHIVED"
        ? 409
        : 400;

    return Response.json(
      { error: error.message },
      { status },
    );
  }

  if (isPrismaUniqueConstraintError(error)) {
    return Response.json(
      { error: "Ai adăugat deja acest tratament." },
      { status: 409 },
    );
  }

  console.error("Student treatment API error:", error);

  return Response.json(
    { error: "Tratamentele nu au putut fi procesate." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const authorization =
      await authorizeStudentTreatmentRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const treatments = await prisma.studentTreatment.findMany({
      where: {
        studentProfileId: authorization.studentProfileId,
        deletedAt: null,
      },
      orderBy: [
        {
          isActive: "desc",
        },
        {
          treatment: {
            name: "asc",
          },
        },
      ],
      select: studentTreatmentSelect,
    });

    return Response.json({
      treatments,
    });
  } catch (error) {
    return treatmentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const authorization =
      await authorizeStudentTreatmentRequest(request, {
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

    const parsedInput = parseCreateStudentTreatmentInput(body);

    if (!parsedInput.ok) {
      return Response.json(
        { error: parsedInput.error },
        { status: 400 },
      );
    }

    const treatment = await createStudentTreatment(
      authorization.studentProfileId,
      parsedInput.data,
    );

    return Response.json(
      {
        treatment,
      },
      { status: 201 },
    );
  } catch (error) {
    return treatmentErrorResponse(error);
  }
}
