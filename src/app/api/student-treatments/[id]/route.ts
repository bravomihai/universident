import {
  archiveStudentTreatment,
  StudentTreatmentDomainError,
  updateStudentTreatment,
} from "@/lib/student-treatments/student-treatment-service";
import { parseUpdateStudentTreatmentInput } from "@/lib/student-treatments/student-treatment-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";
import { SchedulingTemporarilyUnavailableError } from "@/lib/scheduling/transaction";

type StudentTreatmentRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function treatmentMutationErrorResponse(error: unknown) {
  if (error instanceof SchedulingTemporarilyUnavailableError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: 503, headers: { "Retry-After": "1" } },
    );
  }
  if (error instanceof StudentTreatmentDomainError) {
    if (error.code === "TREATMENT_NOT_FOUND") {
      return Response.json(
        { error: error.message },
        { status: 404 },
      );
    }

    const status = error.code === "TREATMENT_ARCHIVED" ||
      error.code === "RESOURCE_IN_CALENDAR" ||
      error.code === "RESOURCE_LIMIT_EXCEEDED"
      ? 409
      : 400;

    return Response.json(
      { error: error.message },
      { status },
    );
  }

  console.error("Student treatment mutation error:", error);

  return Response.json(
    { error: "Tratamentul nu a putut fi actualizat." },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  context: StudentTreatmentRouteContext,
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
      return Response.json(
        { error: "Tratamentul nu a fost găsit." },
        { status: 404 },
      );
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

    const parsedInput = parseUpdateStudentTreatmentInput(body);

    if (!parsedInput.ok) {
      return Response.json(
        { error: parsedInput.error },
        { status: 400 },
      );
    }

    const treatment = await updateStudentTreatment(
      authorization.studentProfileId,
      id,
      parsedInput.data,
    );

    return Response.json({
      treatment,
    });
  } catch (error) {
    return treatmentMutationErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: StudentTreatmentRouteContext,
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
      return Response.json(
        { error: "Tratamentul nu a fost găsit." },
        { status: 404 },
      );
    }

    const result = await archiveStudentTreatment(
      authorization.studentProfileId,
      id,
    );

    return Response.json({
      archivedTreatmentId: id,
      archivedAt: result.archivedAt,
    });
  } catch (error) {
    return treatmentMutationErrorResponse(error);
  }
}
