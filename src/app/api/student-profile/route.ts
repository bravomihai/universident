import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StudentProfileBody = {
  university?: unknown;
  studyYear?: unknown;
  city?: unknown;
  bio?: unknown;
  isPublished?: unknown;
};

export async function PUT(request: Request) {
  const configuredUrl = process.env.BETTER_AUTH_URL;

  if (!configuredUrl) {
    return Response.json(
      { error: "Serverul nu este configurat corect." },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(configuredUrl).origin;

  if (origin !== expectedOrigin) {
    return Response.json(
      { error: "Originea cererii nu este permisă." },
      { status: 403 },
    );
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return Response.json(
      { error: "Trebuie să fii autentificat." },
      { status: 401 },
    );
  }

  if (session.user.role !== UserRole.STUDENT) {
    return Response.json(
      { error: "Doar studenții își pot configura profilul profesional." },
      { status: 403 },
    );
  }

  let body: StudentProfileBody;

  try {
    body = (await request.json()) as StudentProfileBody;
  } catch {
    return Response.json(
      { error: "Datele trimise nu sunt valide." },
      { status: 400 },
    );
  }

  const university =
    typeof body.university === "string" ? body.university.trim() : "";

  const city = typeof body.city === "string" ? body.city.trim() : "";

  const bio = typeof body.bio === "string" ? body.bio.trim() : "";

  const studyYear =
    typeof body.studyYear === "number" ? body.studyYear : Number.NaN;

  const isPublished =
    typeof body.isPublished === "boolean" ? body.isPublished : false;

  if (university.length < 2 || university.length > 120) {
    return Response.json(
      { error: "Universitatea trebuie să conțină între 2 și 120 de caractere." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 6) {
    return Response.json(
      { error: "Anul de studiu trebuie să fie între 1 și 6." },
      { status: 400 },
    );
  }

  if (city.length < 2 || city.length > 80) {
    return Response.json(
      { error: "Orașul trebuie să conțină între 2 și 80 de caractere." },
      { status: 400 },
    );
  }

  if (bio.length > 1000) {
    return Response.json(
      { error: "Descrierea poate avea cel mult 1000 de caractere." },
      { status: 400 },
    );
  }

  const profile = await prisma.studentProfile.upsert({
    where: {
      userId: session.user.id,
    },
    update: {
      university,
      studyYear,
      city,
      bio: bio || null,
      isPublished,
    },
    create: {
      userId: session.user.id,
      university,
      studyYear,
      city,
      bio: bio || null,
      isPublished,
    },
  });

  return Response.json({
    profile,
  });
}