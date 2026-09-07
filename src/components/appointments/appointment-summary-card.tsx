import type { ReactNode } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";

import { formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { AppointmentStatusBadges } from "@/components/appointments/appointment-status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clickableCardIndicatorClassName } from "@/components/ui/clickable-card-styles";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type {
  AppointmentCardSource,
  AppointmentCounterpart,
} from "@/lib/appointments/appointment-card-data";
import { cn } from "@/lib/utils";

export function AppointmentSummaryCard({
  appointment,
  counterpart,
  role,
  needsAttention,
  isUnread,
  cancelAction,
}: {
  appointment: AppointmentCardSource;
  counterpart: AppointmentCounterpart;
  role: "PATIENT" | "STUDENT";
  needsAttention: boolean;
  isUnread: boolean;
  cancelAction: ReactNode;
}) {
  return (
    <Card size="sm" className={cn(isUnread && "ring-1 ring-primary/35", needsAttention && "ring-1 ring-orange-400/50")}>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ProfileAvatar name={counterpart.name} imageUrl={counterpart.imageUrl} className="size-11 text-sm" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{counterpart.label}</p>
              <h3 className="break-words font-semibold leading-snug">{counterpart.name}</h3>
              <p className="mt-0.5 break-words text-sm text-muted-foreground">{appointment.treatmentNameSnapshot}</p>
            </div>
          </div>
          <AppointmentStatusBadges
            status={appointment.status}
            role={role}
            needsAttention={needsAttention}
            isUnread={isUnread}
          />
        </div>
        <div className="grid gap-3 rounded-xl border bg-muted/15 p-3 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Data și ora</p>
              <p className="mt-0.5 break-words font-medium">
                {formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Locație</p>
              <p className="mt-0.5 break-words font-medium">{appointment.locationNameSnapshot}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-t pt-4">
          <Button asChild variant="outline" className="group">
            <Link
              href={`/cont/programari/${encodeURIComponent(appointment.routeSlug)}`}
              aria-label={`Vezi detaliile programării pentru ${appointment.treatmentNameSnapshot}`}
            >
              Vezi detaliile <span className={clickableCardIndicatorClassName} aria-hidden="true">&gt;</span>
            </Link>
          </Button>
          <div className="ml-auto min-w-0">{cancelAction}</div>
        </div>
      </CardContent>
    </Card>
  );
}
