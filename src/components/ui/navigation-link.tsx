import type { ComponentProps } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationLinkProps = ComponentProps<typeof Link> & {
  direction?: "forward" | "back";
};

export function NavigationLink({
  href,
  children,
  className,
  direction = "forward",
  ...props
}: NavigationLinkProps) {
  const arrow = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block font-semibold transition-transform duration-150",
        direction === "back"
          ? "group-hover/navigation:-translate-x-0.5 group-focus-visible/navigation:-translate-x-0.5"
          : "group-hover/navigation:translate-x-0.5 group-focus-visible/navigation:translate-x-0.5",
      )}
    >
      {direction === "back" ? "<" : ">"}
    </span>
  );
  const content = (
    <>
      {direction === "back" ? arrow : null}
      <span>{children}</span>
      {direction === "forward" ? arrow : null}
    </>
  );

  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={cn("navigation-link group/navigation w-fit rounded-[.85rem] text-base shadow-xs", className)}
    >
      {typeof href === "string" && href.startsWith("#") ? (
        // In-page anchors should scroll natively, without a router transition.
        <a {...props} href={href}>{content}</a>
      ) : (
        <Link {...props} href={href}>{content}</Link>
      )}
    </Button>
  );
}
