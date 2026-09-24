"use client";

import Link from "@/components/navigation/app-link";
import { useNavigationEntry } from "@/components/navigation/navigation-provider";
import { contextualBackLink } from "@/lib/navigation/return-navigation";
import { NavigationLink } from "@/components/ui/navigation-link";

type BackLinkProps = {
  className?: string;
  variant?: "button" | "text";
};

export function BackLink({ className, variant = "button" }: BackLinkProps) {
  const back = contextualBackLink(useNavigationEntry());
  if (variant === "text") {
    return <Link href={back.href} navigation="back" className={className}><span aria-hidden="true">&lt; </span>{back.label}</Link>;
  }
  return (
    <NavigationLink href={back.href} navigation="back" direction="back" className={className}>
      {back.label}
    </NavigationLink>
  );
}
