"use client";

import {
  Archive,
  CircleCheck,
  CirclePause,
  Clock3,
  GraduationCap,
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

export type StudentTreatmentLocationData = {
  id: string;
  studentLocationId: string;
  name: string;
  address: string;
  cityName: string;
  isActive: boolean;
  supervisor: {
    id: string;
    fullName: string;
    academicTitle: string | null;
    isActive: boolean;
  };
};

export type StudentTreatmentCardData = {
  id: string;
  treatmentId: string;
  treatmentSlug: string;
  name: string;
  catalogDescription: string;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  locations: StudentTreatmentLocationData[];
  createdAt: string;
  updatedAt: string;
};

type StudentTreatmentCardProps = {
  treatment: StudentTreatmentCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onToggleActive: (treatment: StudentTreatmentCardData) => void;
  onArchive: (treatment: StudentTreatmentCardData) => void;
};

export function StudentTreatmentCard({
  treatment,
  isPending,
  isDisabled,
  feedback,
  onToggleActive,
  onArchive,
}: StudentTreatmentCardProps) {
  const StatusIcon = treatment.isActive
    ? CircleCheck
    : CirclePause;
  const inactiveLocationCount = treatment.locations.filter(
    (location) => !location.isActive,
  ).length;

  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{treatment.name}</CardTitle>
            <CardDescription>
              {treatment.description || "Fără descriere suplimentară"}
            </CardDescription>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
            <StatusIcon className="size-3.5" aria-hidden="true" />
            {treatment.isActive ? "Activ" : "Inactiv"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Durată
            </dt>
            <dd>{treatment.durationMinutes} minute</dd>
          </div>

          <div className="space-y-2">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              Locații și supervizare
            </dt>

            <dd>
              {treatment.locations.length > 0 ? (
                <ul className="space-y-2">
                  {treatment.locations.map((location) => (
                    <li
                      key={location.id}
                      className="rounded-xl border bg-muted/20 px-3 py-2"
                    >
                      <span className="block font-medium">
                        {location.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {location.cityName} ·{" "}
                        {location.isActive ? "Activă" : "Inactivă"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {location.address}
                      </span>
                      <span
                        className="mt-2 flex items-center gap-1.5 text-sm"
                      >
                        <GraduationCap
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {[
                          location.supervisor.academicTitle,
                          location.supervisor.fullName,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span>Nicio locație asociată</span>
              )}
            </dd>
          </div>
        </dl>

        {treatment.locations.length > 0 &&
        inactiveLocationCount === treatment.locations.length ? (
          <p className="text-sm text-muted-foreground">
            Toate locațiile asociate sunt inactive. Tratamentul nu
            poate fi activat.
          </p>
        ) : null}

        <StudentCardFeedbackMessage feedback={feedback} />

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/cont/tratamente/${treatment.treatmentSlug}/editare`}
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
            onClick={() => onToggleActive(treatment)}
          >
            <Power aria-hidden="true" />
            {treatment.isActive ? "Dezactivare" : "Activare"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDisabled}
            onClick={() => onArchive(treatment)}
          >
            <Archive aria-hidden="true" />
            Arhivare
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
