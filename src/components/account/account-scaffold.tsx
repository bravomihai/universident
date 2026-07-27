import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountScaffoldStatusProps = {
  children?: ReactNode;
};

export function AccountScaffoldStatus({
  children = "În curând",
}: AccountScaffoldStatusProps) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

type AccountScaffoldRowProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  statusLabel?: string;
  isDangerous?: boolean;
};

export function AccountScaffoldRow({
  icon,
  title,
  description,
  actionLabel,
  statusLabel = "În curând",
  isDangerous = false,
}: AccountScaffoldRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b py-5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between",
        isDangerous &&
          "rounded-xl border border-destructive/20 bg-destructive/5 p-4 last:border-b",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30",
            isDangerous &&
              "border-destructive/20 bg-destructive/10 text-destructive",
          )}
        >
          {icon}
        </span>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            <AccountScaffoldStatus>
              {statusLabel}
            </AccountScaffoldStatus>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {actionLabel ? (
        <Button
          type="button"
          variant={isDangerous ? "destructive" : "outline"}
          size="sm"
          className="h-auto min-h-8 w-full shrink-0 whitespace-normal py-2 text-center sm:w-auto"
          disabled
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
