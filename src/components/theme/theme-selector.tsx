"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { headerIconControlClassName } from "@/components/layout/header-action-styles";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeMenuOptions() {
    const { theme, setTheme } = useTheme();

    return (
        <DropdownMenuRadioGroup
            aria-label="Temă"
            value={theme ?? "system"}
            onValueChange={setTheme}
        >
            <DropdownMenuRadioItem value="system">
                <Monitor />
                Sistem
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
                <Sun />
                Luminos
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
                <Moon />
                Întunecat
            </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
    );
}

export function ThemeSelector() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(headerIconControlClassName, "relative hidden shrink-0 min-[420px]:inline-flex")}
                    aria-label="Schimbă tema"
                >
                    <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                    <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />

                    <span className="sr-only">Schimbă tema</span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="hidden min-[420px]:block">
                <ThemeMenuOptions />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
