import { MapPin, Stethoscope, UsersRound } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ProfessionalArea = "treatments" | "locations" | "supervisors";

const professionalAreas = [
  {
    id: "treatments",
    href: "/cont/tratamente",
    label: "Tratamente",
    icon: Stethoscope,
  },
  {
    id: "locations",
    href: "/cont/locatii",
    label: "Locații",
    icon: MapPin,
  },
  {
    id: "supervisors",
    href: "/cont/supervizori",
    label: "Supervizori",
    icon: UsersRound,
  },
] as const;

type StudentProfessionalNavigationProps = {
  current: ProfessionalArea;
};

export function StudentProfessionalNavigation({
  current,
}: StudentProfessionalNavigationProps) {
  return (
    <nav
      aria-label="Administrare profil profesional"
      className="grid grid-cols-3 gap-1 rounded-2xl border bg-muted/20 p-1"
    >
      {professionalAreas.map((area) => {
        const Icon = area.icon;
        const isCurrent = current === area.id;

        return (
          <Link
            key={area.id}
            href={area.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm",
              isCurrent
                ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{area.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
