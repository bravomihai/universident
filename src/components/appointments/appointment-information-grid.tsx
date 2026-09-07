import type { ReactNode } from "react";
import { Info, MapPin, MessageSquare, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { RatingStars } from "@/components/reviews/rating-summary";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import {
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import type {
  AppointmentCardSource,
  AppointmentCounterpart,
} from "@/lib/appointments/appointment-card-data";
import { cn } from "@/lib/utils";

const panelClass = "h-full min-w-0 rounded-[var(--card-radius)] border bg-muted/15 p-4";

function DetailPanel({ icon: Icon, title, children, className }: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(panelClass, className)}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {title}
      </h3>
      <div className="text-sm leading-relaxed [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

export function AppointmentInformationGrid({ appointment, counterpart }: {
  appointment: AppointmentCardSource;
  counterpart: AppointmentCounterpart;
}) {
  const profile = (
    <div className={cn(panelClass, counterpart.href && "ui-card-interactive")}>
      <div className="flex items-start gap-3">
        <ProfileAvatar name={counterpart.name} imageUrl={counterpart.imageUrl} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{counterpart.label}</p>
          <h3 className="mt-0.5 break-words font-semibold">{counterpart.name}</h3>
          {counterpart.subtitle ? (
            <p className="mt-1 break-words text-sm text-muted-foreground">{counterpart.subtitle}</p>
          ) : null}
        </div>
        {counterpart.href ? (
          <span className={clickableCardIndicatorClassName} aria-hidden="true">&gt;</span>
        ) : null}
      </div>
      <div className="mt-3">
        <RatingStars {...counterpart.summary} className="gap-1.5" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {counterpart.href ? "Vezi profilul și recenziile" : "Profilul nu este disponibil public."}
      </p>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {counterpart.href ? (
        <Link
          href={counterpart.href}
          className={clickableCardLinkClassName}
          aria-label={`Vezi profilul: ${counterpart.name}`}
        >
          {profile}
        </Link>
      ) : profile}
      <DetailPanel icon={ShieldCheck} title="Profesor supervizor">
        <p className="font-medium">{appointment.supervisorNameSnapshot}</p>
      </DetailPanel>
      <DetailPanel icon={MapPin} title="Locație">
        <p className="font-medium">{appointment.locationNameSnapshot}</p>
        <p className="mt-1 whitespace-pre-line text-muted-foreground">{appointment.locationAddressSnapshot}</p>
      </DetailPanel>
      <DetailPanel icon={MessageSquare} title="Mesajul pacientului">
        {appointment.patientNote?.trim() ? (
          <p className="whitespace-pre-wrap font-medium">{appointment.patientNote}</p>
        ) : (
          <p className="text-muted-foreground">Nu a fost adăugat niciun mesaj.</p>
        )}
      </DetailPanel>
      {appointment.statusReason ? (
        <DetailPanel icon={Info} title="Motiv" className="sm:col-span-2">
          <p className="whitespace-pre-wrap">{appointment.statusReason}</p>
        </DetailPanel>
      ) : null}
    </div>
  );
}
