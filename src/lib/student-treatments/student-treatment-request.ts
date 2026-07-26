import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuthorizedStudentTreatmentRequest =
  | {
      ok: true;
      studentProfileId: string;
    }
  | {
      ok: false;
      response: Response;
    };

type AuthorizeStudentTreatmentRequestOptions = {
  verifyOrigin?: boolean;
};

export async function authorizeStudentTreatmentRequest(
  request: Request,
  {
    verifyOrigin = false,
  }: AuthorizeStudentTreatmentRequestOptions = {},
): Promise<AuthorizedStudentTreatmentRequest> {
  if (verifyOrigin) {
    const configuredUrl = process.env.BETTER_AUTH_URL;

    if (!configuredUrl) {
      return {
        ok: false,
        response: Response.json(
          { error: "Serverul nu este configurat corect." },
          { status: 500 },
        ),
      };
    }

    let expectedOrigin: string;

    try {
      expectedOrigin = new URL(configuredUrl).origin;
    } catch {
      return {
        ok: false,
        response: Response.json(
          { error: "Serverul nu este configurat corect." },
          { status: 500 },
        ),
      };
    }

    if (request.headers.get("origin") !== expectedOrigin) {
      return {
        ok: false,
        response: Response.json(
          { error: "Originea cererii nu este permisă." },
          { status: 403 },
        ),
      };
    }
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Trebuie să fii autentificat." },
        { status: 401 },
      ),
    };
  }

  if (session.user.role !== UserRole.STUDENT) {
    return {
      ok: false,
      response: Response.json(
        { error: "Doar studenții își pot administra tratamentele." },
        { status: 403 },
      ),
    };
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!studentProfile) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "Completează profilul profesional înainte de a administra tratamente.",
        },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    studentProfileId: studentProfile.id,
  };
}
