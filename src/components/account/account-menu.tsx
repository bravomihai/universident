"use client";

import Link from "next/link";
import { ChevronDown, GraduationCap, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProfileIcon } from "@/components/icons/profile-icon";
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

type AccountMenuProps = {
    name: string;
    roleLabel: string;
    showStudentProfile: boolean;
};

export function AccountMenu({
    name,
    roleLabel,
    showStudentProfile,
}: AccountMenuProps) {
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-9 min-w-0 max-w-full shrink gap-1 px-1.5 min-[300px]:px-2 sm:h-auto sm:gap-2 sm:px-3 sm:py-1.5"
                    aria-label={`Deschide meniul contului pentru ${name}`}
                >
                    <ProfileIcon className="size-5 shrink-0 text-foreground" />

                    <span className="hidden min-w-0 text-right sm:block">
                        <span className="block max-w-48 truncate text-sm font-medium">
                            {name}
                        </span>

                        <span className="block text-xs text-muted-foreground">
                            {roleLabel}
                        </span>
                    </span>

                    <ChevronDown className="hidden size-4 shrink-0 text-foreground min-[280px]:block" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-[min(13rem,calc(100vw-2rem))]"
            >
                <DropdownMenuLabel className="font-normal sm:hidden">
                    <span className="block max-w-48 truncate text-sm font-medium text-foreground">
                        {name}
                    </span>

                    <span className="block text-xs font-normal text-muted-foreground">
                        {roleLabel}
                    </span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="sm:hidden" />

                <DropdownMenuItem asChild>
                    <Link href="/cont">
                        <UserRound />
                        Contul meu
                    </Link>
                </DropdownMenuItem>

                {showStudentProfile ? (
                    <DropdownMenuItem asChild>
                        <Link href="/cont/profil-student">
                            <GraduationCap />
                            Profil profesional
                        </Link>
                    </DropdownMenuItem>
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}