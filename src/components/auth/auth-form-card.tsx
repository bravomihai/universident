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
    <main id="main-content" className="app-page auth-page flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="auth-frame w-full max-w-md md:max-w-xl">
        <Card className="auth-card w-full">
          <CardHeader className="gap-4">
            {icon ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                  {icon}
                </span>
                <CardTitle><h1>{title}</h1></CardTitle>
              </div>
            ) : (
              <CardTitle><h1>{title}</h1></CardTitle>
            )}

            {description ? (
              <CardDescription className="text-base leading-relaxed">{description}</CardDescription>
            ) : null}
          </CardHeader>

          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
