import Link from "next/link";
import { headers } from "next/headers";

import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

const roleLabels: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Pacient",
  [UserRole.STUDENT]: "Student",
  [UserRole.ADMIN]: "Administrator",
};

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-tight"
        >
          Universident
        </Link>

        {session ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium">
                {session.user.name}
              </p>

              <p className="text-xs text-muted-foreground">
                {roleLabels[session.user.role]}
              </p>
            </div>

            <SignOutButton />
          </div>
        ) : (
          <nav
            aria-label="Navigare cont"
            className="flex items-center gap-2"
          >
            <Link
              href="/autentificare"
              className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Autentificare
            </Link>

            <Link
              href="/inregistrare"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Creează cont
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}