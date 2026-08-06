import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createStudentPublicSlug,
  isStudentPublicSlugCollision,
} from "@/lib/student-public-slug";
import {
  evaluateStudentPublication,
  type StudentPublicationRequirement,
} from "@/lib/student-publication/student-publication-readiness";

class ProfileNotFoundError extends Error {}

class PublicationRequirementsError extends Error {
  constructor(
    readonly missingRequirements: StudentPublicationRequirement[],
  ) {
    super("Publication requirements are not met.");
  }
}

function publicationErrorResponse(error: unknown) {
  if (error instanceof ProfileNotFoundError) {
    return Response.json(
      { error: "Completează profilul profesional înainte de publicare." },
      { status: 404 },
    );
  }

  if (error instanceof PublicationRequirementsError) {
    return Response.json(
      {
        error: "Profilul necesită completări înainte de publicare.",
        code: "PUBLICATION_REQUIREMENTS_NOT_MET",
        missingRequirements: error.missingRequirements,
      },
      { status: 409 },
    );
  }

  console.error("Student profile publication error:", error);
  return Response.json(
    { error: "Vizibilitatea profilului nu a putut fi actualizată." },
    { status: 500 },
  );
}

function hasExactPublicationBody(value: unknown): value is {
  isPublished: boolean;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "isPublished" in value &&
    typeof value.isPublished === "boolean"
  );
}

export async function PUT(request: Request) {
  const configuredUrl = process.env.BETTER_AUTH_URL;

  if (!configuredUrl) {
    return Response.json(
      { error: "Serverul nu este configurat corect." },
      { status: 500 },
    );
  }

  let expectedOrigin: string;

  try {
    expectedOrigin = new URL(configuredUrl).origin;
  } catch {
    return Response.json(
      { error: "Serverul nu este configurat corect." },
      { status: 500 },
    );
  }

  if (request.headers.get("origin") !== expectedOrigin) {
    return Response.json(
      { error: "Originea cererii nu este permisă." },
      { status: 403 },
    );
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json(
      { error: "Trebuie să fii autentificat." },
      { status: 401 },
    );
  }

  if (!session.user.emailVerified) {
    return Response.json(
      {
        error: "Verifică adresa de email înainte de a continua.",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    );
  }

  if (session.user.role !== UserRole.STUDENT) {
    return Response.json(
      { error: "Doar studenții își pot publica profilul profesional." },
      { status: 403 },
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

  if (!hasExactPublicationBody(body)) {
    return Response.json(
      { error: "Datele trimise nu sunt valide." },
      { status: 400 },
    );
  }

  const maximumAttempts = body.isPublished ? 5 : 1;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (transaction) => {
          const evaluation = await evaluateStudentPublication(
            transaction,
            session.user.id,
          );

          if (!evaluation.profileId) throw new ProfileNotFoundError();

          if (body.isPublished && !evaluation.canPublish) {
            throw new PublicationRequirementsError(
              evaluation.missingRequirements,
            );
          }

          const publicSlug =
            evaluation.publicSlug ??
            (body.isPublished
              ? createStudentPublicSlug(
                  evaluation.userName ?? session.user.name,
                )
              : null);

          await transaction.studentProfile.update({
            where: { id: evaluation.profileId },
            data: body.isPublished
              ? {
                  isPublished: true,
                  publishedAt: new Date(),
                  publicSlug: publicSlug!,
                }
              : {
                  isPublished: false,
                  publishedAt: null,
                },
          });

          return {
            isPublished: body.isPublished,
            isPubliclyVisible: body.isPublished,
            publicPath: publicSlug ? `/studenti/${publicSlug}` : null,
          };
        },
        { isolationLevel: "Serializable" },
      );

      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (
        body.isPublished &&
        isStudentPublicSlugCollision(error) &&
        attempt + 1 < maximumAttempts
      ) {
        continue;
      }

      return publicationErrorResponse(error);
    }
  }

  return Response.json(
    { error: "Adresa publică a profilului nu a putut fi generată." },
    { status: 500 },
  );
}
