import Link from "next/link";
import { headers } from "next/headers";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProfileIcon } from "@/components/icons/profile-icon";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";

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
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/cont"
              className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-muted"
            >
              <ProfileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />

              <span className="min-w-0 text-right">
                <span className="block max-w-32 truncate text-sm font-medium sm:max-w-48">
                  {session.user.name}
                </span>

                <span className="block text-xs text-muted-foreground">
                  {roleLabels[session.user.role]}
                </span>
              </span>
            </Link>

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