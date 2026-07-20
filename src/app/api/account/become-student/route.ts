import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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

  if (session.user.role === UserRole.ADMIN) {
    return Response.json(
      { error: "Rolul de administrator nu poate fi modificat." },
      { status: 403 },
    );
  }

  if (session.user.role === UserRole.STUDENT) {
    return Response.json({
      role: UserRole.STUDENT,
    });
  }

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      role: UserRole.STUDENT,
    },
    select: {
      role: true,
    },
  });

  return Response.json({
    role: user.role,
  });
}