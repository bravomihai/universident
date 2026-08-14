"use client";

import { LogIn, Menu, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { headerIconControlClassName } from "@/components/layout/header-action-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderMobileNavigationProps = {
  isAuthenticated: boolean;
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderMobileNavigation({
  isAuthenticated,
}: HeaderMobileNavigationProps) {
  const pathname = usePathname();
  const studentsCurrent = isCurrentPath(pathname, "/studenti");
  const signInCurrent = isCurrentPath(pathname, "/autentificare");
  const signUpCurrent = isCurrentPath(pathname, "/inregistrare");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(headerIconControlClassName, "shrink-0 md:hidden")}
          aria-label="Deschide navigarea principală"
          aria-controls="mobile-primary-navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">Meniu principal</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        id="mobile-primary-navigation"
        align="end"
        className="w-[min(17rem,calc(100vw-1.5rem))]"
      >
        <DropdownMenuItem
          asChild
          className={studentsCurrent ? "bg-accent" : undefined}
        >
          <Link
            href="/studenti"
            aria-current={studentsCurrent ? "page" : undefined}
          >
            <Search aria-hidden="true" />
            Găsește un student
          </Link>
        </DropdownMenuItem>

        {!isAuthenticated ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className={signInCurrent ? "bg-accent" : undefined}
            >
              <Link
                href="/autentificare"
                aria-current={signInCurrent ? "page" : undefined}
              >
                <LogIn aria-hidden="true" />
                Autentificare
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className={signUpCurrent ? "bg-accent" : undefined}
            >
              <Link
                href="/inregistrare"
                aria-current={signUpCurrent ? "page" : undefined}
              >
                <UserPlus aria-hidden="true" />
                Creează cont
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
