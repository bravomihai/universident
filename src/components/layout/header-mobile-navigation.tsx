"use client";

import { CircleHelp, LogIn, Menu, UserPlus, Users } from "lucide-react";
import Link from "@/components/navigation/app-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountMenuIdentity, AccountMenuItems, type AccountMenuProps } from "@/components/account/account-menu";
import { compactHeaderIconControlClassName, headerIconControlClassName } from "@/components/layout/header-action-styles";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { useHeaderMenuFocus } from "@/components/layout/use-header-menu-focus";
import { ThemeMenuOptions } from "@/components/theme/theme-selector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderMobileNavigationProps = {
  account?: AccountMenuProps;
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderMobileNavigation({
  account,
}: HeaderMobileNavigationProps) {
  const pathname = usePathname();
  const { triggerRef, ...focusHandlers } = useHeaderMenuFocus();
  const [open, setOpen] = useState(false);
  const signInCurrent = isCurrentPath(pathname, "/autentificare");
  const signUpCurrent = isCurrentPath(pathname, "/inregistrare");

  useEffect(() => {
    if (!open) return;

    const desktopHeader = window.matchMedia("(min-width: 1150px)");
    const closeOnDesktop = () => {
      if (desktopHeader.matches) setOpen(false);
    };
    desktopHeader.addEventListener("change", closeOnDesktop);
    return () => desktopHeader.removeEventListener("change", closeOnDesktop);
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(headerIconControlClassName, "shrink-0 min-[1150px]:hidden", compactHeaderIconControlClassName)}
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
        {...focusHandlers}
      >
        {account ? (
          <DropdownMenuGroup className="min-[340px]:hidden">
            <AccountMenuIdentity name={account.name} roleLabel={account.roleLabel} />
            <AccountMenuItems showStudentNavigation={account.showStudentNavigation} />
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ) : (
          <>
            <DropdownMenuItem
              asChild
              className={cn("lg:hidden", signInCurrent && "bg-accent")}
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
              className={cn("lg:hidden", signUpCurrent && "bg-accent")}
            >
              <Link
                href="/inregistrare"
                aria-current={signUpCurrent ? "page" : undefined}
              >
                <UserPlus aria-hidden="true" />
                Creează cont
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="lg:hidden" />
          </>
        )}
        <DropdownMenuItem asChild className="min-[1150px]:hidden">
          <Link href="/echipa" aria-current={isCurrentPath(pathname, "/echipa") ? "page" : undefined}><Users aria-hidden="true" />Echipa</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <HomeSectionLink sectionId="cum-functioneaza"><CircleHelp aria-hidden="true" />Cum funcționează</HomeSectionLink>
        </DropdownMenuItem>
        <DropdownMenuGroup className="min-[420px]:hidden">
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Temă</DropdownMenuLabel>
          <ThemeMenuOptions />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
