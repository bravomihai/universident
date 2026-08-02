import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthFormCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
};

export function AuthFormCard({
  title,
  description,
  icon,
  children,
}: AuthFormCardProps) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <Card className="w-full max-w-md md:max-w-xl">
        <CardHeader>
          {icon ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                {icon}
              </span>
              <CardTitle>{title}</CardTitle>
            </div>
          ) : (
            <CardTitle>{title}</CardTitle>
          )}

          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
