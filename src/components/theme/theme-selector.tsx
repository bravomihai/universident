"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative size-9 shrink-0"
                    aria-label="Schimbă tema"
                >
                    <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                    <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />

                    <span className="sr-only">Schimbă tema</span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}