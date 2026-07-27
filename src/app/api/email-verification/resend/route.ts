import { auth } from "@/lib/auth";

const genericResponse = {
  message:
    "Dacă adresa corespunde unui cont neverificat, vei primi un nou email de verificare.",
};

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Cererea nu este validă." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((field) => field !== "email") ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return Response.json(
      { error: "Cererea nu este validă." },
      { status: 400 },
    );
  }

  const email = body.email.trim();

  if (!email || email.length > 320) {
    return Response.json(genericResponse);
  }

  const authRequestHeaders = new Headers(request.headers);
  authRequestHeaders.set("content-type", "application/json");

  const authRequest = new Request(
    new URL("/api/auth/send-verification-email", request.url),
    {
      method: "POST",
      headers: authRequestHeaders,
      body: JSON.stringify({
        email,
        callbackURL: "/verifica-email?verificat=1",
      }),
    },
  );

  try {
    await auth.handler(authRequest);
  } catch {
    // Răspunsul public rămâne identic indiferent de existența contului
    // sau de rezultatul livrării, pentru a evita email enumeration.
  }

  return Response.json(genericResponse);
}
