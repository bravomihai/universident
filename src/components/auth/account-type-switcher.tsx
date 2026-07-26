"use client";

import { cn } from "@/lib/utils";

type AccountType = "patient" | "student";

type AccountTypeSwitcherProps = {
  value: AccountType;
  onChange: (value: AccountType) => void;
};

export function AccountTypeSwitcher({
  value,
  onChange,
}: AccountTypeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Alege tipul contului"
      className="grid grid-cols-2 rounded-xl bg-muted p-1"
    >
      <button
        type="button"
        aria-pressed={value === "patient"}
        className={cn(
          "rounded-lg px-4 py-2 text-center text-sm font-medium transition",
          value === "patient"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("patient")}
      >
        Pacient
      </button>

      <button
        type="button"
        aria-pressed={value === "student"}
        className={cn(
          "rounded-lg px-4 py-2 text-center text-sm font-medium transition",
          value === "student"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("student")}
      >
        Student
      </button>
    </div>
  );
}