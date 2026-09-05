import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { prisma } from "@/lib/prisma";
import {
  nextProfileRefreshAt,
  PROFILE_REFRESH_COOLDOWN_MS,
} from "@/lib/student-profile/profile-refresh";

function jsonResponse(
  body: unknown,
  status = 200,
  retryAfterSeconds?: number,
) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfterSeconds) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }

  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.STUDENT],
  });
  if (!authorization.ok) return authorization.response;

  const now = new Date();
  const cooldownCutoff = new Date(
    now.getTime() - PROFILE_REFRESH_COOLDOWN_MS,
  );

  try {
    const refreshed = await prisma.studentProfile.updateMany({
      where: {
        userId: authorization.user.id,
        isPublished: true,
        OR: [
          { lastRefreshedAt: null },
          { lastRefreshedAt: { lte: cooldownCutoff } },
        ],
      },
      data: { lastRefreshedAt: now },
    });

    if (refreshed.count === 1) {
      return jsonResponse({
        status: true,
        lastRefreshedAt: now.toISOString(),
        nextRefreshAt: nextProfileRefreshAt(now).toISOString(),
      });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: authorization.user.id },
      select: { isPublished: true, lastRefreshedAt: true },
    });

    if (!profile) {
      return jsonResponse(
        {
          error: "Salvează mai întâi informațiile profesionale.",
          code: "PROFILE_MISSING",
        },
        404,
      );
    }

    if (!profile.isPublished) {
      return jsonResponse(
        {
          error: "Publică profilul înainte de a-l actualiza în rezultate.",
          code: "PROFILE_NOT_PUBLISHED",
        },
        409,
      );
    }

    if (!profile.lastRefreshedAt) {
      return jsonResponse(
        {
          error: "Starea profilului s-a schimbat. Încearcă din nou.",
          code: "PROFILE_REFRESH_RETRY",
        },
        409,
      );
    }

    const nextRefreshAt = nextProfileRefreshAt(profile.lastRefreshedAt);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((nextRefreshAt.getTime() - now.getTime()) / 1000),
    );

    return jsonResponse(
      {
        error: "Profilul poate fi actualizat o dată la 20 de ore.",
        code: "PROFILE_REFRESH_COOLDOWN",
        lastRefreshedAt: profile.lastRefreshedAt.toISOString(),
        nextRefreshAt: nextRefreshAt.toISOString(),
      },
      429,
      retryAfterSeconds,
    );
  } catch (error) {
    console.error("Student profile refresh failed:", error);
    return jsonResponse(
      {
        error: "Profilul nu a putut fi actualizat în rezultate.",
        code: "PROFILE_REFRESH_FAILED",
      },
      500,
    );
  }
}
