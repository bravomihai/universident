import Link from "next/link";
import { headers } from "next/headers";
import { CircleHelp, Search, Users } from "lucide-react";

import {
  HeaderAccount,
  type HeaderUser,
} from "@/components/layout/header-account";
import { auth } from "@/lib/auth";

import { ThemeSelector } from "@/components/theme/theme-selector";
import { headerNeutralControlClassName } from "@/components/layout/header-action-styles";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { SiteBrand } from "@/components/layout/site-brand";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const initialUser: HeaderUser | null = session?.user.emailVerified
    ? {
        name: session.user.name,
        role: session.user.role,
      }
    : null;

  return (
    <header className="site-header border-b border-border/60">
      <div className="mx-auto flex min-h-18 w-full max-w-6xl items-center gap-2 px-4 sm:min-h-20 sm:gap-4 sm:px-6">
        <SiteBrand />

        <div className="ml-auto flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
          <Link
            href="/echipa"
            className={cn(
              headerNeutralControlClassName,
              "hidden shrink-0 items-center gap-2 px-3 text-sm font-medium xl:inline-flex",
            )}
          >
            <Users className="size-4" aria-hidden="true" />
            <span>Echipa</span>
          </Link>
          <HomeSectionLink
            sectionId="cum-functioneaza"
            className={cn(
              headerNeutralControlClassName,
              "hidden shrink-0 items-center gap-2 px-3 text-sm font-medium lg:inline-flex",
            )}
          >
            <CircleHelp className="size-4" aria-hidden="true" />
            <span>Cum funcționează</span>
          </HomeSectionLink>
          <Link
            href="/studenti"
            aria-label="Găsește un student"
            className={cn(
              headerNeutralControlClassName,
              "hidden shrink-0 items-center justify-center gap-2 px-3 text-sm font-medium md:inline-flex",
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            <span>Găsește un student</span>
          </Link>

          <HeaderAccount initialUser={initialUser} />

          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
