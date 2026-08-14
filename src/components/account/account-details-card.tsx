import { UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function AccountDetailsCard({
  email,
  roleLabel,
}: {
  email: string;
  roleLabel: string;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="font-semibold">Detalii cont</h2>
            <p className="text-sm text-muted-foreground">
              Date disponibile doar pentru consultare.
            </p>
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="truncate font-medium" title={email}>
              {email}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Rol</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
