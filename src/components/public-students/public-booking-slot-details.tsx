import { UserRound } from "lucide-react";

type BookingSlotDetails = {
  treatment: { name: string };
  location: { name: string; address: string; city: { name: string } };
  supervisor: { fullName: string; academicTitle: string | null };
};

export function PublicBookingSlotDetails({ slot }: { slot: BookingSlotDetails }) {
  const supervisorName = [slot.supervisor.academicTitle, slot.supervisor.fullName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-xl border bg-muted/20 p-4 [overflow-wrap:anywhere]">
      <p className="font-semibold">{slot.treatment.name}</p>
      <p className="text-sm text-muted-foreground">
        {slot.location.name} · {slot.location.city.name}
      </p>
      <p className="text-sm text-muted-foreground">{slot.location.address}</p>
      <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-sm text-muted-foreground">
        <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Profesor supervizor: <span className="font-medium text-foreground">{supervisorName}</span>
        </span>
      </p>
    </div>
  );
}
