"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AccountTypeSwitcher() {
  const pathname = usePathname();

  const activeType = pathname.startsWith("/inregistrare/student")
    ? "student"
    : "patient";

  return (
    <nav
      aria-label="Alege tipul contului"
      className="grid grid-cols-2 rounded-xl bg-muted p-1"
    >
      <Link
        href="/inregistrare"
        aria-current={activeType === "patient" ? "page" : undefined}
        className={cn(
          "rounded-lg px-4 py-2 text-center text-sm font-medium transition",
          activeType === "patient"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Pacient
      </Link>

      <Link
        href="/inregistrare/student"
        aria-current={activeType === "student" ? "page" : undefined}
        className={cn(
          "rounded-lg px-4 py-2 text-center text-sm font-medium transition",
          activeType === "student"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Student
      </Link>
    </nav>
  );
}