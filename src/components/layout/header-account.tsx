"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import {
  headerControlGeometryClassName,
  headerNeutralControlClassName,
} from "@/components/layout/header-action-styles";
import { HeaderMobileNavigation } from "@/components/layout/header-mobile-navigation";
import { UserRole } from "@/generated/prisma/enums";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

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
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <AccountMenu
          name={user.name}
          roleLabel={roleLabels[user.role]}
          showStudentNavigation={user.role === UserRole.STUDENT}
        />
        <HeaderMobileNavigation isAuthenticated />
      </div>
    );
  }

  return (
    <>
      <nav
        aria-label="Navigare cont"
        className="hidden items-center gap-2 lg:flex"
      >
        <Link
          href="/autentificare"
          className={cn(
            headerNeutralControlClassName,
            "inline-flex items-center px-3 text-sm font-medium",
          )}
        >
          Autentificare
        </Link>

        <Link
          href="/inregistrare"
          className={cn(
            headerControlGeometryClassName,
            "inline-flex items-center bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        >
          Creează cont
        </Link>
      </nav>

      <HeaderMobileNavigation isAuthenticated={false} />
    </>
  );
}
