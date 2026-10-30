import { readJsonRequest } from "@/lib/api/request-body";
import { prisma } from "@/lib/prisma";
import { studentSupervisorSelect } from "@/lib/student-supervisors/student-supervisor-data";
import { parseCreateStudentSupervisorInput } from "@/lib/student-supervisors/student-supervisor-input";
import { authorizeStudentTreatmentRequest } from "@/lib/student-treatments/student-treatment-request";

function unexpectedError(error: unknown) {
  console.error("Student supervisor API error:", error);

  return Response.json(
    { error: "Profesorii nu au putut fi procesați." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const authorization = await authorizeStudentTreatmentRequest(request);

    if (!authorization.ok) return authorization.response;

    const supervisors = await prisma.studentSupervisor.findMany({
      where: {
        studentProfileId: authorization.studentProfileId,
        deletedAt: null,
      },
      orderBy: { fullName: "asc" },
      select: studentSupervisorSelect,
    });

    return Response.json({ supervisors });
  } catch (error) {
    return unexpectedError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeStudentTreatmentRequest(request, {
      verifyOrigin: true,
    });

    if (!authorization.ok) return authorization.response;

    const bodyResult = await readJsonRequest(request);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;

    const parsedInput = parseCreateStudentSupervisorInput(body);

    if (!parsedInput.ok) {
      return Response.json({ error: parsedInput.error }, { status: 400 });
    }

    const supervisor = await prisma.studentSupervisor.create({
      data: {
        studentProfileId: authorization.studentProfileId,
        ...parsedInput.data,
      },
      select: studentSupervisorSelect,
    });

    return Response.json({ supervisor }, { status: 201 });
  } catch (error) {
    return unexpectedError(error);
  }
}
