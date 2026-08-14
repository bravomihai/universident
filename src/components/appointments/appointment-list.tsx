import Link from "next/link";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { appointmentStatusLabels, formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { Card, CardContent } from "@/components/ui/card";

export type AppointmentListItem = {
  routeSlug: string;
  version: number;
  status: string;
  scheduledStartsAt: Date | string;
  scheduledEndsAt: Date | string;
  patientNameSnapshot: string;
  studentNameSnapshot: string;
  treatmentNameSnapshot: string;
  locationNameSnapshot: string;
  isLateCancellation: boolean;
  statusReason: string | null;
};

export function AppointmentList({
  appointments,
  role,
  compact = false,
}: {
  appointments: AppointmentListItem[];
  role: "PATIENT" | "STUDENT";
  compact?: boolean;
}) {
  if (appointments.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nu există încă programări.</p>;
  }
  return (
    <div className="grid gap-3">
      {appointments.map((appointment) => (
        <Card key={appointment.routeSlug}>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link href={`/cont/programari/${appointment.routeSlug}`} className="font-semibold underline-offset-4 hover:underline">
                  {appointment.treatmentNameSnapshot}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatAppointmentInterval(appointment.scheduledStartsAt, appointment.scheduledEndsAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {role === "PATIENT" ? appointment.studentNameSnapshot : appointment.patientNameSnapshot} · {appointment.locationNameSnapshot}
                </p>
              </div>
              <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-medium">
                {appointmentStatusLabels[appointment.status] ?? appointment.status}
              </span>
            </div>
            {!compact && appointment.statusReason ? <p className="text-sm text-muted-foreground">Motiv: {appointment.statusReason}</p> : null}
            {!compact ? (
              <AppointmentActions
                appointmentSlug={appointment.routeSlug}
                version={appointment.version}
                status={appointment.status}
                role={role}
                startsAt={new Date(appointment.scheduledStartsAt).toISOString()}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
