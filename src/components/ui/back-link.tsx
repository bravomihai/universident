import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={cn("group/back w-fit rounded-xl text-base shadow-xs", className)}
    >
      <Link href={href}>
        <span
          aria-hidden="true"
          className="inline-block font-semibold transition-transform duration-150 group-hover/back:-translate-x-0.5 group-focus-visible/back:-translate-x-0.5"
        >
          {"<"}
        </span>
        <span>{children}</span>
      </Link>
    </Button>
  );
}
