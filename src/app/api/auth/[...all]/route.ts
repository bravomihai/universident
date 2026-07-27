import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

const unverifiedSessionAllowedPaths = new Set([
  "/get-session",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-out",
  "/sign-up/email",
  "/verify-email",
]);

async function blockProtectedRequestForUnverifiedSession(
  request: Request,
) {
  const pathname = new URL(request.url).pathname;
  const authPath = pathname.startsWith("/api/auth")
    ? pathname.slice("/api/auth".length) || "/"
    : pathname;

  if (unverifiedSessionAllowedPaths.has(authPath)) {
    return null;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || session.user.emailVerified) {
    return null;
  }

  return Response.json(
    {
      error: "Verifică adresa de email înainte de a continua.",
      code: "EMAIL_NOT_VERIFIED",
    },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  const blockedResponse =
    await blockProtectedRequestForUnverifiedSession(request);

  if (blockedResponse) {
    return blockedResponse;
  }

  const response = await handlers.GET(request);

  if (
    new URL(request.url).pathname === "/api/auth/verify-email"
  ) {
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("referrer-policy", "no-referrer");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  return response;
}

export async function POST(request: Request) {
  const blockedResponse =
    await blockProtectedRequestForUnverifiedSession(request);

  return blockedResponse ?? handlers.POST(request);
}
