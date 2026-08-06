import Link from "next/link";
import { headers } from "next/headers";
import { Search } from "lucide-react";

import {
  HeaderAccount,
  type HeaderUser,
} from "@/components/layout/header-account";
import { auth } from "@/lib/auth";

import { ThemeSelector } from "@/components/theme/theme-selector";

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
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-tight sm:text-xl"
        >
          Universident
        </Link>

        <div className="ml-auto flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
          <Link
            href="/studenti"
            aria-label="Găsește un student"
            className="hidden h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:inline-flex"
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
