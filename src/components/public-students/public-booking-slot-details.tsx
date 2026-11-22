import { UserRound } from "lucide-react";
import { treatmentSupervisionLabel } from "@/lib/student-profile/supervision-label";

type BookingSlotDetails = {
  treatment: { name: string };
  location: { name: string; address: string; city: { name: string } };
};

export function PublicBookingSlotDetails({ slot, university }: { slot: BookingSlotDetails; university: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 [overflow-wrap:anywhere]">
      <p className="font-semibold">{slot.treatment.name}</p>
      <p className="text-sm text-muted-foreground">
        {slot.location.name} · {slot.location.city.name}
      </p>
      <p className="text-sm text-muted-foreground">{slot.location.address}</p>
      <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-sm text-muted-foreground">
        <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{treatmentSupervisionLabel(university)}</span>
      </p>
    </div>
  );
}
