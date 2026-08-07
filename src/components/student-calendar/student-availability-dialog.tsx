"use client";

import { CalendarClock, Repeat2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDENT_CALENDAR_PROTOTYPE_CATALOG } from "@/lib/student-calendar/student-calendar-mock";
import {
  addMinutes,
  humanRecurrenceDescription,
  parseLocalDateTime,
  recurrenceFromDraft,
  toDateInputValue,
  toTimeInputValue,
  weekdayForDate,
  type StudentCalendarRecurrenceDraft,
} from "@/lib/student-calendar/student-calendar-prototype-logic";
import type {
  StudentCalendarEvent,
  StudentCalendarRecurrence,
  StudentCalendarRecurrenceEnd,
  StudentCalendarRecurrenceFrequency,
  StudentCalendarWeekday,
} from "@/lib/student-calendar/student-calendar-types";
import { STUDENT_CALENDAR_WEEKDAYS } from "@/lib/student-calendar/student-calendar-types";

export type StudentAvailabilitySubmission = {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  treatmentLocationId: string;
  treatmentName: string;
  locationName: string;
  supervisorName: string;
  recurrence: StudentCalendarRecurrence;
};

type StudentAvailabilityDialogProps = {
  open: boolean;
  initialEvent: StudentCalendarEvent | null;
  initialStartsAt: Date;
  onOpenChange: (open: boolean) => void;
  onSave: (submission: StudentAvailabilitySubmission) => string | null;
};

type AvailabilityFormState = {
  treatmentId: string;
  locationId: string;
  supervisorId: string;
  date: string;
  time: string;
  frequency: StudentCalendarRecurrenceFrequency;
  weekdays: StudentCalendarWeekday[];
  endType: StudentCalendarRecurrenceEnd["type"];
  endDate: string;
  occurrenceCount: number;
};

function defaultEndDate(startsAt: Date) {
  const result = new Date(startsAt);
  result.setDate(result.getDate() + 56);
  return toDateInputValue(result);
}

function initialFormState(
  initialEvent: StudentCalendarEvent | null,
  initialStartsAt: Date,
): AvailabilityFormState {
  const startsAt = initialEvent
    ? new Date(initialEvent.startsAt)
    : initialStartsAt;
  const matchingTreatment = STUDENT_CALENDAR_PROTOTYPE_CATALOG.treatments.find(
    (treatment) => treatment.name === initialEvent?.treatmentName,
  );
  const matchingLocation = STUDENT_CALENDAR_PROTOTYPE_CATALOG.locations.find(
    (location) => location.name === initialEvent?.locationName,
  );
  const matchingSupervisor =
    STUDENT_CALENDAR_PROTOTYPE_CATALOG.supervisors.find(
      (supervisor) => supervisor.name === initialEvent?.supervisorName,
    );
  const recurrence = initialEvent?.recurrence;

  return {
    treatmentId:
      matchingTreatment?.id ??
      STUDENT_CALENDAR_PROTOTYPE_CATALOG.treatments[0].id,
    locationId:
      matchingLocation?.id ?? STUDENT_CALENDAR_PROTOTYPE_CATALOG.locations[0].id,
    supervisorId:
      matchingSupervisor?.id ??
      STUDENT_CALENDAR_PROTOTYPE_CATALOG.supervisors[0].id,
    date: toDateInputValue(startsAt),
    time: toTimeInputValue(startsAt),
    frequency: recurrence?.frequency ?? "none",
    weekdays:
      recurrence && recurrence.weekdays.length > 0
        ? recurrence.weekdays
        : [weekdayForDate(startsAt)],
    endType: recurrence?.ends.type ?? "never",
    endDate:
      recurrence?.ends.type === "onDate"
        ? recurrence.ends.date
        : defaultEndDate(startsAt),
    occurrenceCount:
      recurrence?.ends.type === "afterCount" ? recurrence.ends.count : 6,
  };
}

function associationId(state: AvailabilityFormState) {
  return `prototype:${state.treatmentId}:${state.locationId}:${state.supervisorId}`;
}

export function StudentAvailabilityDialog({
  open,
  initialEvent,
  initialStartsAt,
  onOpenChange,
  onSave,
}: StudentAvailabilityDialogProps) {
  const [form, setForm] = useState<AvailabilityFormState>(() =>
    initialFormState(initialEvent, initialStartsAt),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const treatment = STUDENT_CALENDAR_PROTOTYPE_CATALOG.treatments.find(
    (option) => option.id === form.treatmentId,
  );
  const location = STUDENT_CALENDAR_PROTOTYPE_CATALOG.locations.find(
    (option) => option.id === form.locationId,
  );
  const supervisor = STUDENT_CALENDAR_PROTOTYPE_CATALOG.supervisors.find(
    (option) => option.id === form.supervisorId,
  );
  const parsedStartsAt = parseLocalDateTime(form.date, form.time);
  const recurrenceDraft: StudentCalendarRecurrenceDraft = {
    frequency: form.frequency,
    weekdays: form.weekdays,
    endType: form.endType,
    endDate: form.endDate,
    occurrenceCount: form.occurrenceCount,
  };
  const recurrence = recurrenceFromDraft(recurrenceDraft);
  const humanRule = parsedStartsAt
    ? humanRecurrenceDescription(recurrence, parsedStartsAt)
    : "Completează data și ora pentru a vedea regula.";

  function updateWeekday(weekday: StudentCalendarWeekday, checked: boolean) {
    setForm((current) => ({
      ...current,
      weekdays: checked
        ? [...new Set([...current.weekdays, weekday])]
        : current.weekdays.filter((candidate) => candidate !== weekday),
    }));
  }

  function submitAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!treatment || !location || !supervisor || !parsedStartsAt) {
      setErrorMessage("Completează toate câmpurile obligatorii.");
      return;
    }

    if (form.frequency !== "none" && form.weekdays.length === 0) {
      setErrorMessage("Alege cel puțin o zi pentru repetare.");
      return;
    }

    if (
      form.frequency !== "none" &&
      form.endType === "onDate" &&
      (!form.endDate || form.endDate < form.date)
    ) {
      setErrorMessage("Data de încheiere trebuie să fie după data de început.");
      return;
    }

    if (
      form.frequency !== "none" &&
      form.endType === "afterCount" &&
      (!Number.isInteger(form.occurrenceCount) ||
        form.occurrenceCount < 2 ||
        form.occurrenceCount > 40)
    ) {
      setErrorMessage("Numărul de apariții trebuie să fie între 2 și 40.");
      return;
    }

    const saveError = onSave({
      startsAt: parsedStartsAt,
      endsAt: addMinutes(parsedStartsAt, treatment.durationMinutes),
      durationMinutes: treatment.durationMinutes,
      treatmentLocationId: associationId(form),
      treatmentName: treatment.name,
      locationName: location.name,
      supervisorName: supervisor.name,
      recurrence,
    });

    if (saveError) {
      setErrorMessage(saveError);
      return;
    }

    onOpenChange(false);
  }

  const isEditing = initialEvent !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editează disponibilitatea" : "Adaugă disponibilitate"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificarea manuală se aplică apariției selectate. Pentru o serie, apariția devine excepție."
              : "Configurează un slot demonstrativ. Salvarea modifică numai memoria acestei pagini."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submitAvailability}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="calendar-treatment">Tratament</Label>
              <Select
                value={form.treatmentId}
                onValueChange={(treatmentId) =>
                  setForm((current) => ({ ...current, treatmentId }))
                }
              >
                <SelectTrigger id="calendar-treatment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_CALENDAR_PROTOTYPE_CATALOG.treatments.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-location">Locație</Label>
              <Select
                value={form.locationId}
                onValueChange={(locationId) =>
                  setForm((current) => ({ ...current, locationId }))
                }
              >
                <SelectTrigger id="calendar-location" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_CALENDAR_PROTOTYPE_CATALOG.locations.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-supervisor">Supervizor</Label>
              <Select
                value={form.supervisorId}
                onValueChange={(supervisorId) =>
                  setForm((current) => ({ ...current, supervisorId }))
                }
              >
                <SelectTrigger id="calendar-supervisor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_CALENDAR_PROTOTYPE_CATALOG.supervisors.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-date">Data</Label>
              <Input
                id="calendar-date"
                type="date"
                required
                value={form.date}
                onChange={(event) => {
                  const date = event.target.value;
                  const parsed = parseLocalDateTime(date, form.time);
                  setForm((current) => ({
                    ...current,
                    date,
                    weekdays:
                      current.frequency === "none" || !parsed
                        ? current.weekdays
                        : [weekdayForDate(parsed)],
                  }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-time">Ora</Label>
              <Input
                id="calendar-time"
                type="time"
                step={900}
                required
                value={form.time}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
            <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Durata tratamentului</p>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {treatment?.durationMinutes ?? 0} minute · stabilită automat
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border p-4">
            <div className="flex items-center gap-2">
              <Repeat2 className="size-4" aria-hidden="true" />
              <h3 className="font-medium">Repetare</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-recurrence">Frecvență</Label>
              <Select
                value={form.frequency}
                disabled={isEditing}
                onValueChange={(frequency) => {
                  if (
                    frequency !== "none" &&
                    frequency !== "weekly" &&
                    frequency !== "biweekly"
                  ) {
                    return;
                  }

                  setForm((current) => ({
                    ...current,
                    frequency,
                    weekdays:
                      frequency === "none"
                        ? current.weekdays
                        : parsedStartsAt
                          ? [weekdayForDate(parsedStartsAt)]
                          : current.weekdays,
                  }));
                }}
              >
                <SelectTrigger id="calendar-recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nu se repetă</SelectItem>
                  <SelectItem value="weekly">Săptămânal</SelectItem>
                  <SelectItem value="biweekly">La două săptămâni</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.frequency !== "none" ? (
              <>
                <fieldset className="space-y-2" disabled={isEditing}>
                  <legend className="text-sm font-medium">Zilele săptămânii</legend>
                  <div className="flex flex-wrap gap-2">
                    {STUDENT_CALENDAR_WEEKDAYS.map((weekday) => (
                      <label
                        key={weekday.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={form.weekdays.includes(weekday.id)}
                          onChange={(event) =>
                            updateWeekday(weekday.id, event.target.checked)
                          }
                        />
                        {weekday.shortLabel}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="calendar-recurrence-end">Terminare</Label>
                  <Select
                    value={form.endType}
                    disabled={isEditing}
                    onValueChange={(endType) => {
                      if (
                        endType !== "never" &&
                        endType !== "onDate" &&
                        endType !== "afterCount"
                      ) {
                        return;
                      }

                      setForm((current) => ({ ...current, endType }));
                    }}
                  >
                    <SelectTrigger id="calendar-recurrence-end" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Niciodată</SelectItem>
                      <SelectItem value="onDate">La data...</SelectItem>
                      <SelectItem value="afterCount">După ... apariții</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.endType === "onDate" ? (
                  <div className="space-y-2">
                    <Label htmlFor="calendar-end-date">Data de încheiere</Label>
                    <Input
                      id="calendar-end-date"
                      type="date"
                      disabled={isEditing}
                      required
                      min={form.date}
                      value={form.endDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : null}

                {form.endType === "afterCount" ? (
                  <div className="space-y-2">
                    <Label htmlFor="calendar-occurrence-count">
                      Număr de apariții
                    </Label>
                    <Input
                      id="calendar-occurrence-count"
                      type="number"
                      disabled={isEditing}
                      min={2}
                      max={40}
                      required
                      value={form.occurrenceCount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          occurrenceCount: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            <p className="rounded-xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {humanRule}
            </p>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Renunță
              </Button>
            </DialogClose>
            <Button type="submit">
              {isEditing ? "Salvează modificările" : "Adaugă disponibilitatea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
