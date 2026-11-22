"use client";

import Link from "@/components/navigation/app-link";
import {
    ChevronDown,
    CalendarDays,
    MessageCircle,
    GraduationCap,
    LogOut,
    UserRound,
} from "lucide-react";
import { useRouter } from "@/components/navigation/use-app-router";
import { useEffect, useState } from "react";

import { ProfileIcon } from "@/components/icons/profile-icon";
import { headerNeutralControlClassName } from "@/components/layout/header-action-styles";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type AccountMenuProps = {
    name: string;
    roleLabel: string;
    showStudentNavigation: boolean;
};

export function AccountMenuIdentity({
    name,
    roleLabel,
    className,
}: Pick<AccountMenuProps, "name" | "roleLabel"> & { className?: string }) {
    return (
        <DropdownMenuLabel className={className}>
            <span className="block truncate">{name}</span>
            <span className="block text-xs font-normal text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
    );
}

export function AccountMenuItems({ showStudentNavigation }: Pick<AccountMenuProps, "showStudentNavigation">) {
    const router = useRouter();

    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function handleSignOut() {
        setIsPending(true);
        setErrorMessage(null);

        try {
            const { error } = await authClient.signOut();

            if (error) {
                setErrorMessage("Deconectarea nu a reușit.");
                return;
            }

            router.replace("/");
            router.refresh();
        } catch {
            setErrorMessage("A apărut o eroare de conexiune.");
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <DropdownMenuItem asChild>
                <Link href="/cont">
                    <UserRound />
                    Contul meu
                </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
                <Link href="/cont/programari">
                    <CalendarDays />
                    Programările mele
                </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
                <Link href="/cont/mesaje"><MessageCircle />Mesaje</Link>
            </DropdownMenuItem>

            {!showStudentNavigation ? (
                <DropdownMenuItem asChild>
                    <Link href="/cont/profil-pacient">
                        <UserRound />
                        Profil pacient
                    </Link>
                </DropdownMenuItem>
            ) : null}

            {showStudentNavigation ? (
                <>
                    <DropdownMenuItem asChild>
                        <Link href="/cont/profil-student">
                            <GraduationCap />
                            Profil profesional
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                        <Link href="/cont/calendar">
                            <CalendarDays />
                            Calendar
                        </Link>
                    </DropdownMenuItem>
                </>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
                disabled={isPending}
                className="text-destructive focus:text-destructive"
                onSelect={(event) => {
                    event.preventDefault();
                    void handleSignOut();
                }}
            >
                <LogOut />
                {isPending ? "Se deconectează..." : "Deconectare"}
            </DropdownMenuItem>

            {errorMessage ? (
                <DropdownMenuLabel className="text-xs font-normal text-destructive">
                    {errorMessage}
                </DropdownMenuLabel>
            ) : null}
        </>
    );
}

export function AccountMenu({
    name,
    roleLabel,
    showStudentNavigation,
}: AccountMenuProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        const hasRoomForAccount = window.matchMedia("(min-width: 340px)");
        const closeOnCompactHeader = () => {
            if (!hasRoomForAccount.matches) setOpen(false);
        };
        hasRoomForAccount.addEventListener("change", closeOnCompactHeader);
        return () => hasRoomForAccount.removeEventListener("change", closeOnCompactHeader);
    }, [open]);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                        headerNeutralControlClassName,
                        "hidden min-w-11 max-w-full shrink px-2 min-[340px]:inline-flex sm:min-w-0 sm:gap-2 sm:px-3",
                    )}
                    aria-label={`Deschide meniul contului pentru ${name}`}
                >
                    <ProfileIcon className="size-5 shrink-0 text-foreground" />

                    <span className="hidden min-w-0 text-right sm:block">
                        <span className="block max-w-48 truncate text-sm font-medium leading-4">
                            {name}
                        </span>

                        <span className="block text-xs leading-3 text-muted-foreground">
                            {roleLabel}
                        </span>
                    </span>

                    <ChevronDown className="hidden size-4 shrink-0 text-foreground sm:block" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[min(13rem,calc(100vw-2rem))]">
                <AccountMenuIdentity name={name} roleLabel={roleLabel} className="sm:hidden" />
                <DropdownMenuSeparator className="sm:hidden" />
                <AccountMenuItems showStudentNavigation={showStudentNavigation} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
