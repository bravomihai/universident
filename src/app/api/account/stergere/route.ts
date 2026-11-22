import { UserRole } from "@/generated/prisma/enums";
import {
  AccountDeletionError,
  accountDeletionIdentity,
  confirmAccountDeletion,
  requestAccountDeletion,
} from "@/lib/account/account-deletion-service";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { readJsonRequest } from "@/lib/api/request-body";
import { auth } from "@/lib/auth";

const noStore = { "Cache-Control": "no-store" };

function problem(error: string, status: number, retryAfter?: string | null) {
  return Response.json({ error }, {
    status, headers: { ...noStore, ...(retryAfter ? { "Retry-After": retryAfter } : {}) },
  });
}

export async function POST(request: Request) {
  const account = await authorizeAccountRequest(request, {
    verifyOrigin: true, roles: [UserRole.PATIENT, UserRole.STUDENT],
  });
  if (!account.ok) return account.response;
  const body = await readJsonRequest(request);
  if (!body.ok) return body.response;
  const password = body.data && typeof body.data === "object" && "currentPassword" in body.data
    ? body.data.currentPassword : null;
  if (typeof password !== "string" || !password || password.length > 128) {
    return problem("Introdu parola actuală.", 400);
  }

  try {
    const identity = await accountDeletionIdentity(account.user.id);
    if (!identity) return problem("Contul nu este disponibil pentru această operațiune.", 403);

    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const verification = await auth.handler(new Request(new URL("/api/auth/verify-password", request.url), {
      method: "POST", headers, body: JSON.stringify({ password }),
    }));
    if (verification.status === 429) {
      return problem("Prea multe încercări. Așteaptă puțin și încearcă din nou.", 429, verification.headers.get("retry-after"));
    }
    if (!verification.ok) {
      const payload: { code?: string } | null = await verification.json().catch(() => null);
      return payload?.code === "INVALID_PASSWORD"
        ? problem("Parola actuală este incorectă.", 400)
        : problem("Parola actuală nu a putut fi verificată. Autentifică-te și încearcă din nou.", 401);
    }

    await requestAccountDeletion(identity);
    return Response.json({ ok: true }, { status: 202, headers: noStore });
  } catch (error) {
    if (error instanceof AccountDeletionError && error.code === "RATE_LIMITED") {
      return problem("Așteaptă un minut înainte de a solicita alt link.", 429, "60");
    }
    return problem("Linkul de confirmare nu a putut fi trimis. Încearcă din nou.", 503);
  }
}

export async function DELETE(request: Request) {
  let origin: string;
  try {
    origin = new URL(process.env.BETTER_AUTH_URL ?? "").origin;
  } catch {
    return problem("Serverul nu este configurat corect.", 500);
  }
  if (request.headers.get("origin") !== origin) return problem("Originea cererii nu este permisă.", 403);

  const body = await readJsonRequest(request);
  if (!body.ok) return body.response;
  const token = body.data && typeof body.data === "object" && "token" in body.data ? body.data.token : null;
  if (typeof token !== "string") return problem("Linkul de confirmare nu este valid.", 400);
  try {
    await confirmAccountDeletion(token);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AccountDeletionError && error.code === "INVALID_LINK") {
      return problem("Linkul a expirat, a fost folosit sau nu mai este valid.", 400);
    }
    return problem("Contul nu a putut fi șters. Încearcă din nou folosind același link.", 503);
  }
}
