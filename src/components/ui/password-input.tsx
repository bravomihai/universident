"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  ...props
}: ComponentProps<typeof Input>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-10", className)}
        disabled={disabled}
        type={isPasswordVisible ? "text" : "password"}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-4xl text-muted-foreground transition-colors hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        onClick={() =>
          setIsPasswordVisible((currentValue) => !currentValue)
        }
        aria-controls={props.id}
        aria-label={
          isPasswordVisible ? "Ascunde parola" : "Afișează parola"
        }
        aria-pressed={isPasswordVisible}
        disabled={disabled}
      >
        {isPasswordVisible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
