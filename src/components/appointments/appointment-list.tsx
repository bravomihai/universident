import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { AppointmentSummaryCard } from "@/components/appointments/appointment-summary-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  appointmentCounterpart,
  type AppointmentCardSource,
} from "@/lib/appointments/appointment-card-data";
import {
  appointmentNeedsAttention,
  hasAppointmentReview,
  orderAppointmentsForRole,
} from "@/lib/appointments/appointment-presentation";

export type AppointmentListItem = AppointmentCardSource;

export function AppointmentList({
  appointments,
  role,
  unreadAppointmentSlugs = [],
  emptyMessage = "Nu există încă programări.",
}: {
  appointments: AppointmentListItem[];
  role: "PATIENT" | "STUDENT";
  unreadAppointmentSlugs?: string[];
  emptyMessage?: string;
}) {
  if (!appointments.length) {
    return (
      <Card size="sm">
        <CardContent><p className="text-sm text-muted-foreground">{emptyMessage}</p></CardContent>
      </Card>
    );
  }

  const now = new Date();
  const unreadSlugs = new Set(unreadAppointmentSlugs);

  return (
    <div className="grid gap-4">
      {orderAppointmentsForRole(appointments, role, now).map((appointment) => (
        <AppointmentSummaryCard
          key={appointment.routeSlug}
          appointment={appointment}
          counterpart={appointmentCounterpart(appointment, role)}
          role={role}
          needsAttention={appointmentNeedsAttention(appointment, role, now)}
          isUnread={unreadSlugs.has(appointment.routeSlug)}
          cancelAction={
            <AppointmentActions
              appointmentSlug={appointment.routeSlug}
              version={appointment.version}
              status={appointment.status}
              role={role}
              startsAt={new Date(appointment.scheduledStartsAt).toISOString()}
              endsAt={new Date(appointment.scheduledEndsAt).toISOString()}
              reviewedByActor={hasAppointmentReview(appointment, role)}
              mode="cancel-only"
            />
          }
        />
      ))}
    </div>
  );
}
