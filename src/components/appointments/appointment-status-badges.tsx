import { appointmentStatusLabels } from "@/components/appointments/appointment-status";
import { cn } from "@/lib/utils";

const badgeClass = "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-4";

export function AppointmentStatusBadges({ status, role, needsAttention = false, isUnread = false }: {
  status: string;
  role: "PATIENT" | "STUDENT";
  needsAttention?: boolean;
  isUnread?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(badgeClass,
        status === "CONFIRMED" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "PENDING" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status === "COMPLETED" && "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        !["CONFIRMED", "PENDING", "COMPLETED"].includes(status) && "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
      )}>{appointmentStatusLabels[status] ?? status}</span>
      {needsAttention ? <span className={cn(badgeClass, "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300")}>
        {role === "STUDENT" && status === "CONFIRMED" ? "Necesită închidere" : "Recenzie necesară"}
      </span> : null}
      {isUnread ? <span className={cn(badgeClass, "border-primary/35 bg-primary/10 text-primary")}>Nou</span> : null}
    </div>
  );
}
