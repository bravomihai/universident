"use client";

import {
  Archive,
  CircleCheck,
  CirclePause,
  MapPin,
  Pencil,
  Power,
} from "lucide-react";
import Link from "next/link";

import {
  StudentCardFeedbackMessage,
  type StudentCardFeedback,
} from "@/components/student/student-card-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type StudentLocationCardData = {
  id: string;
  cityId: string;
  routeKey: string;
  name: string;
  cityName: string;
  address: string;
  details: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const locationStatusContent = {
  active: {
    label: "Activă",
    icon: CircleCheck,
  },
  inactive: {
    label: "Inactivă",
    icon: CirclePause,
  },
} as const;

type StudentLocationCardProps = {
  location: StudentLocationCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onToggleActive: (location: StudentLocationCardData) => void;
  onArchive: (location: StudentLocationCardData) => void;
};

export function StudentLocationCard({
  location,
  isPending,
  isDisabled,
  feedback,
  onToggleActive,
  onArchive,
}: StudentLocationCardProps) {
  const status = location.isActive
    ? locationStatusContent.active
    : locationStatusContent.inactive;
  const StatusIcon = status.icon;

  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{location.name}</CardTitle>

            <CardDescription className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {location.cityName}
            </CardDescription>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
            <StatusIcon className="size-3.5" aria-hidden="true" />
            {status.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Adresă
            </dt>
            <dd>{location.address}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Detalii
            </dt>
            <dd>{location.details || "Fără detalii suplimentare"}</dd>
          </div>
        </dl>

        <StudentCardFeedbackMessage feedback={feedback} />

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/cont/locatii/${location.routeKey}/editare`}
              aria-disabled={isDisabled}
              tabIndex={isDisabled ? -1 : undefined}
              className={
                isDisabled
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
              onClick={(event) => {
                if (isDisabled) {
                  event.preventDefault();
                }
              }}
            >
              <Pencil aria-hidden="true" />
              Editare
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={() => onToggleActive(location)}
          >
            <Power aria-hidden="true" />
            {location.isActive ? "Dezactivare" : "Activare"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDisabled}
            onClick={() => onArchive(location)}
          >
            <Archive aria-hidden="true" />
            Arhivare
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
