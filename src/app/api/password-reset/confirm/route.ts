import { auth } from "@/lib/auth";

const noStoreHeaders = {
  "cache-control": "no-store",
};

function jsonNoStore(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

function getExpectedOrigin() {
  const configuredUrl = process.env.BETTER_AUTH_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const expectedOrigin = getExpectedOrigin();

  if (!expectedOrigin) {
    return jsonNoStore(
      { error: "Serverul nu este configurat corect." },
      500,
    );
  }

  if (request.headers.get("origin") !== expectedOrigin) {
    return jsonNoStore(
      { error: "Originea cererii nu este permisă." },
      403,
    );
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return jsonNoStore(
      { error: "Cererea trebuie să folosească JSON." },
      415,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Cererea nu este validă." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    !("newPassword" in body) ||
    typeof body.newPassword !== "string" ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    return jsonNoStore({ error: "Cererea nu este validă." }, 400);
  }

  try {
    const authRequestHeaders = new Headers(request.headers);
    authRequestHeaders.set("content-type", "application/json");
    authRequestHeaders.delete("content-length");

    const authRequest = new Request(
      new URL("/api/auth/reset-password", request.url),
      {
        method: "POST",
        headers: authRequestHeaders,
        body: JSON.stringify({
          newPassword: body.newPassword,
          token: body.token,
        }),
      },
    );

    const response = await auth.handler(authRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("cache-control", "no-store");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonNoStore(
      {
        error: "Resetarea parolei nu a putut fi procesată.",
        code: "PASSWORD_RESET_FAILED",
      },
      500,
    );
  }
}
