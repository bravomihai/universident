"use client";

import {
  Archive,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserRound,
} from "lucide-react";

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

export type ArchivedStudentLocationCardData = {
  id: string;
  routeKey: string;
  name: string;
  address: string;
  details: string | null;
  deletedAt: string;
  city: {
    id: string;
    name: string;
    slug: string;
  };
};

export type ArchivedStudentTreatmentCardData = {
  id: string;
  description: string | null;
  durationMinutes: number;
  deletedAt: string;
  treatment: {
    id: string;
    name: string;
    slug: string;
    description: string;
  };
};

export type ArchivedStudentSupervisorCardData = {
  id: string;
  fullName: string;
  academicTitle: string | null;
  deletedAt: string;
};

const archivedDateFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeZone: "Europe/Bucharest",
});

function formatArchivedDate(value: string) {
  return archivedDateFormatter.format(new Date(value));
}

type ArchivedStudentLocationCardProps = {
  location: ArchivedStudentLocationCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onRestore: (location: ArchivedStudentLocationCardData) => void;
};

export function ArchivedStudentLocationCard({
  location,
  isPending,
  isDisabled,
  feedback,
  onRestore,
}: ArchivedStudentLocationCardProps) {
  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{location.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {location.city.name}
            </CardDescription>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
            <Archive className="size-3.5" aria-hidden="true" />
            Arhivată
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
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarDays
                className="size-3.5"
                aria-hidden="true"
              />
              Arhivată la
            </dt>
            <dd>{formatArchivedDate(location.deletedAt)}</dd>
          </div>
        </dl>

        {location.details ? (
          <p className="text-sm text-muted-foreground">
            {location.details}
          </p>
        ) : null}

        <StudentCardFeedbackMessage feedback={feedback} />

        <div className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={() => onRestore(location)}
          >
            <RotateCcw aria-hidden="true" />
            Restaurează locația
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ArchivedStudentTreatmentCardProps = {
  treatment: ArchivedStudentTreatmentCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onRestore: (
    treatment: ArchivedStudentTreatmentCardData,
  ) => void;
};

export function ArchivedStudentTreatmentCard({
  treatment,
  isPending,
  isDisabled,
  feedback,
  onRestore,
}: ArchivedStudentTreatmentCardProps) {
  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{treatment.treatment.name}</CardTitle>
            <CardDescription>
              {treatment.description ||
                "Fără descriere suplimentară"}
            </CardDescription>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
            <Archive className="size-3.5" aria-hidden="true" />
            Arhivat
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

          <div className="space-y-1">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarDays
                className="size-3.5"
                aria-hidden="true"
              />
              Arhivat la
            </dt>
            <dd>{formatArchivedDate(treatment.deletedAt)}</dd>
          </div>
        </dl>

        <StudentCardFeedbackMessage feedback={feedback} />

        <div className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={() => onRestore(treatment)}
          >
            <RotateCcw aria-hidden="true" />
            Restaurează tratamentul
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ArchivedStudentSupervisorCardProps = {
  supervisor: ArchivedStudentSupervisorCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onRestore: (supervisor: ArchivedStudentSupervisorCardData) => void;
};

export function ArchivedStudentSupervisorCard({
  supervisor,
  isPending,
  isDisabled,
  feedback,
  onRestore,
}: ArchivedStudentSupervisorCardProps) {
  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{supervisor.fullName}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              {supervisor.academicTitle ?? "Fără titlu academic"}
            </CardDescription>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
            <Archive className="size-3.5" aria-hidden="true" />
            Arhivat
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl>
          <div className="space-y-1">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Arhivat la
            </dt>
            <dd>{formatArchivedDate(supervisor.deletedAt)}</dd>
          </div>
        </dl>

        <StudentCardFeedbackMessage feedback={feedback} />

        <div className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={() => onRestore(supervisor)}
          >
            <RotateCcw aria-hidden="true" />
            Restaurează supervizorul
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
