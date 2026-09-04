import { authorizeAccountRequest } from "@/lib/api/account-request";
import { auth } from "@/lib/auth";

const jsonHeaders = {
  "cache-control": "no-store",
};

function jsonResponse(body: unknown, status = 200, retryAfter?: string) {
  const headers = new Headers(jsonHeaders);

  if (retryAfter) {
    headers.set("retry-after", retryAfter);
  }

  return Response.json(body, { status, headers });
}

function noStore(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getResponseCode(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "code" in payload &&
    typeof payload.code === "string"
  ) {
    return payload.code;
  }

  return null;
}

function isValidEmail(email: string) {
  return (
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

async function callAuthEndpoint(
  request: Request,
  path: "/verify-password" | "/change-email",
  body: Record<string, unknown>,
) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return auth.handler(
    new Request(new URL(`/api/auth${path}`, request.url), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
  });

  if (!authorization.ok) {
    return noStore(authorization.response);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse(
      { error: "Formatul cererii nu este acceptat.", code: "INVALID_REQUEST" },
      415,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Datele trimise nu sunt valide.", code: "INVALID_REQUEST" },
      400,
    );
  }

  if (typeof body !== "object" || body === null) {
    return jsonResponse(
      { error: "Datele trimise nu sunt valide.", code: "INVALID_REQUEST" },
      400,
    );
  }

  const newEmail =
    "newEmail" in body && typeof body.newEmail === "string"
      ? body.newEmail.trim().toLowerCase()
      : "";
  const currentPassword =
    "currentPassword" in body &&
    typeof body.currentPassword === "string"
      ? body.currentPassword
      : "";

  if (!isValidEmail(newEmail)) {
    return jsonResponse(
      { error: "Adresa de email nu este validă.", code: "INVALID_EMAIL" },
      400,
    );
  }

  if (!currentPassword || currentPassword.length > 128) {
    return jsonResponse(
      { error: "Parola actuală nu este validă.", code: "INVALID_PASSWORD" },
      400,
    );
  }

  if (newEmail === authorization.user.email.trim().toLowerCase()) {
    return jsonResponse(
      {
        error: "Noua adresă trebuie să fie diferită de adresa actuală.",
        code: "EMAIL_UNCHANGED",
      },
      400,
    );
  }

  try {
    const passwordResponse = await callAuthEndpoint(
      request,
      "/verify-password",
      { password: currentPassword },
    );

    if (!passwordResponse.ok) {
      const payload: unknown = await passwordResponse
        .json()
        .catch(() => null);
      const code = getResponseCode(payload);

      if (passwordResponse.status === 429) {
        return jsonResponse(
          { error: "Prea multe încercări.", code: "RATE_LIMITED" },
          429,
          passwordResponse.headers.get("retry-after") ?? undefined,
        );
      }

      if (code === "INVALID_PASSWORD") {
        return jsonResponse(
          { error: "Parola actuală este incorectă.", code },
          400,
        );
      }

      return jsonResponse(
        {
          error: "Parola actuală nu a putut fi verificată.",
          code: "PASSWORD_VERIFICATION_FAILED",
        },
        passwordResponse.status === 401 ? 401 : 400,
      );
    }

    const changeEmailResponse = await callAuthEndpoint(
      request,
      "/change-email",
      {
        newEmail,
        callbackURL: "/cont/securitate?emailSchimbat=1",
      },
    );

    if (!changeEmailResponse.ok) {
      if (changeEmailResponse.status === 429) {
        return jsonResponse(
          { error: "Prea multe încercări.", code: "RATE_LIMITED" },
          429,
          changeEmailResponse.headers.get("retry-after") ?? undefined,
        );
      }

      return jsonResponse(
        {
          error: "Adresa de email nu a putut fi schimbată.",
          code: "EMAIL_CHANGE_FAILED",
        },
        changeEmailResponse.status === 401 ? 401 : 400,
      );
    }

    return jsonResponse({
      status: true,
      message:
        "Dacă adresa poate fi folosită, am trimis un link de verificare.",
    });
  } catch {
    return jsonResponse(
      {
        error: "Adresa de email nu a putut fi schimbată.",
        code: "EMAIL_CHANGE_FAILED",
      },
      500,
    );
  }
}
