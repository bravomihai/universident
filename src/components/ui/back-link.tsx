import type { ReactNode } from "react";
import { NavigationLink } from "@/components/ui/navigation-link";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <NavigationLink href={href} direction="back" className={className}>
      {children}
    </NavigationLink>
  );
}
