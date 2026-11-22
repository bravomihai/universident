import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { missingAccountPolicy } from "@/lib/account/policy-confirmation-service";

type AuthorizedAccountRequest =
  | {
      ok: true;
      user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        role: UserRole;
      };
    }
  | { ok: false; response: Response };

export async function authorizeAccountRequest(
  request: Request,
  options: { verifyOrigin?: boolean; roles?: UserRole[]; requireCurrentPolicy?: boolean } = {},
): Promise<AuthorizedAccountRequest> {
  if (options.verifyOrigin) {
    const configuredUrl = process.env.BETTER_AUTH_URL;
    let expectedOrigin: string;

    try {
      expectedOrigin = new URL(configuredUrl ?? "").origin;
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

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Trebuie să fii autentificat.", code: "AUTHENTICATION_REQUIRED" },
        { status: 401 },
      ),
    };
  }

  if (!session.user.emailVerified) {
    return {
      ok: false,
      response: Response.json(
        { error: "Verifică adresa de email înainte de a continua.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 },
      ),
    };
  }

  if (options.roles && !options.roles.includes(session.user.role)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Nu ai permisiunea necesară.", code: "ROLE_NOT_ALLOWED" },
        { status: 403 },
      ),
    };
  }

  if (options.requireCurrentPolicy && await missingAccountPolicy(session.user)) {
    return {
      ok: false,
      response: Response.json({
        error: "Confirmă informarea din cont înainte de a continua.",
        code: "ACCOUNT_POLICY_REQUIRED",
        href: "/confirma-reguli",
      }, { status: 403, headers: { "Cache-Control": "no-store" } }),
    };
  }

  return { ok: true, user: session.user };
}

