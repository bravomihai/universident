import Link from "next/link";
import { headers } from "next/headers";

import { AccountMenu } from "@/components/account/account-menu";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";

import { ThemeSelector } from "@/components/theme/theme-selector";

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
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="min-w-0 shrink truncate text-lg font-semibold tracking-tight sm:text-xl"
        >
          Universident
        </Link>

        <div className="ml-auto flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
          {session ? (
            <>
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <AccountMenu
                  name={session.user.name}
                  roleLabel={roleLabels[session.user.role]}
                  showStudentProfile={session.user.role === UserRole.STUDENT}
                />
              </div>
            </>
          ) : (
            <nav
              aria-label="Navigare cont"
              className="flex items-center gap-1 sm:gap-2"
            >
              <Link
                href="/autentificare"
                className="rounded-lg px-2 py-2 text-sm font-medium transition hover:bg-muted sm:px-3"
              >
                Autentificare
              </Link>

              <Link
                href="/inregistrare"
                className="rounded-lg bg-primary px-2 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:px-3"
              >
                Creează cont
              </Link>
            </nav>
          )}

          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}