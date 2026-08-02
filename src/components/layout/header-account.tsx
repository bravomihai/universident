"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { UserRole } from "@/generated/prisma/enums";
import { authClient } from "@/lib/auth-client";

const roleLabels: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Pacient",
  [UserRole.STUDENT]: "Student",
  [UserRole.ADMIN]: "Administrator",
};

export type HeaderUser = {
  name: string;
  role: UserRole;
};

type HeaderAccountProps = {
  initialUser: HeaderUser | null;
};

export function HeaderAccount({ initialUser }: HeaderAccountProps) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const { data: session, isPending, refetch } =
    authClient.useSession();

  useEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (pathnameChanged && pathname === "/autentificare") {
      void refetch();
    }
  }, [pathname, refetch]);

  const liveUser = session?.user.emailVerified
    ? {
        name: session.user.name,
        role: session.user.role,
      }
    : null;
  const user =
    pathname === "/autentificare"
      ? null
      : isPending
        ? initialUser
        : liveUser;

  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <AccountMenu
          name={user.name}
          roleLabel={roleLabels[user.role]}
          showStudentNavigation={user.role === UserRole.STUDENT}
        />
      </div>
    );
  }

  return (
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
  );
}
