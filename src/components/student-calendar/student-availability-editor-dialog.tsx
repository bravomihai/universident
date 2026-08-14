"use client";

import { CalendarClock, MapPin, Repeat2, Stethoscope, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { RatingStars } from "@/components/reviews/rating-summary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import type {
  AvailabilityCatalog,
  CalendarSlot,
} from "@/components/student-calendar/student-calendar";
import {
  addLocalDays,
  utcInstantForBucharestLocal,
} from "@/lib/availability/bucharest-time";

type Range = { startsAt: Date; endsAt: Date };
type EditScope = "OCCURRENCE" | "SERIES";
type Repeat = "none" | "weekly" | "biweekly";
type RecurrenceEndMode = "COUNT" | "UNTIL";

type SavePayload = {
  kind: "SINGLE" | "RECURRING";
  scope: EditScope;
  studentLocationId: string;
  offerings: Array<{ studentTreatmentId: string; supervisorId: string }>;
  startsAt: Date;
  endsAt: Date;
  repeat: Repeat;
  recurrenceEndMode: RecurrenceEndMode;
  occurrenceCount: number | null;
  endsOn: string | null;
  appointmentReason: string | null;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function inputParts(value: Date) {
  const parts = formatter.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function intervalMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

function countLabel(value: number) {
  return value === 1 ? "o apariție" : `${value} apariții`;
}

export function StudentAvailabilityEditorDialog({
  open,
  catalog,
  slot,
  range,
  pending,
  seriesHasAppointments,
  onOpenChange,
  onSave,
  onDelete,
  onAppointmentChange,
}: {
  open: boolean;
  catalog: AvailabilityCatalog;
  slot: CalendarSlot | null;
  range: Range;
  pending: boolean;
  seriesHasAppointments: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SavePayload) => Promise<string | null>;
  onDelete: (scope: EditScope, reason: string | null) => Promise<string | null>;
  onAppointmentChange: () => void;
}) {
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const start = inputParts(range.startsAt);
  const end = inputParts(range.endsAt);
  const initialDurationMinutes = intervalMinutes(start.time, end.time);
  const initialRepeat: Repeat = slot?.series
    ? slot.series.intervalWeeks === 2
      ? "biweekly"
      : "weekly"
    : "none";
  const remainingOccurrences =
    slot?.series?.endMode === "COUNT" && slot.series.occurrenceCount
      ? Math.max(1, slot.series.occurrenceCount - (slot.sequenceNumber ?? 1) + 1)
      : 8;
  const initialEndsOn =
    slot?.series?.endMode === "UNTIL" && slot.series.endsOn
      ? slot.series.endsOn.slice(0, 10)
      : addLocalDays(start.date, (initialRepeat === "biweekly" ? 14 : 7) * 7);

  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [locationId, setLocationId] = useState(
    slot?.studentLocation.id ?? catalog.locations[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      slot?.offerings
        .filter(
          (offering) =>
            offering.studentTreatment.durationMinutes <= initialDurationMinutes,
        )
        .map((offering) => [
          offering.studentTreatment.id,
          offering.supervisor.id,
        ]) ?? [],
    ),
  );
  const [editScope, setEditScope] = useState<EditScope>("OCCURRENCE");
  const [repeat, setRepeat] = useState<Repeat>(initialRepeat);
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<RecurrenceEndMode>(
    slot?.series?.endMode === "UNTIL" ? "UNTIL" : "COUNT",
  );
  const [occurrenceCount, setOccurrenceCount] = useState(remainingOccurrences);
  const [endsOn, setEndsOn] = useState(initialEndsOn);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  const occupied = Boolean(slot?.appointments.length);
  const affectsAppointments =
    occupied || (editScope === "SERIES" && seriesHasAppointments);
  const editable = !slot || (slot.status === "ACTIVE" && range.startsAt > new Date());
  const selectedIntervalMinutes = intervalMinutes(startTime, endTime);
  const editsSeries = Boolean(slot?.series && editScope === "SERIES");
  const showsRecurrence = !slot || editsSeries;

  function keepTreatmentsThatFit(nextStartTime: string, nextEndTime: string) {
    const nextDuration = intervalMinutes(nextStartTime, nextEndTime);
    if (nextDuration <= 0) return;
    setSelected((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([treatmentId]) => {
          const treatment = catalog.treatments.find(
            (item) => item.id === treatmentId,
          );
          return treatment && treatment.durationMinutes <= nextDuration;
        }),
      ),
    );
  }

  function changeStartTime(value: string) {
    setStartTime(value);
    keepTreatmentsThatFit(value, endTime);
  }

  function changeEndTime(value: string) {
    setEndTime(value);
    keepTreatmentsThatFit(startTime, value);
  }

  function toggleTreatment(id: string, checked: boolean) {
    const treatment = catalog.treatments.find((item) => item.id === id);
    if (
      checked &&
      (!treatment || treatment.durationMinutes > selectedIntervalMinutes)
    ) {
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[id] = next[id] || catalog.supervisors[0]?.id || "";
      else delete next[id];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const startsAt = utcInstantForBucharestLocal(
      date,
      Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)),
    );
    const endsAt = utcInstantForBucharestLocal(
      date,
      Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5)),
    );
    const offerings = Object.entries(selected).map(
      ([studentTreatmentId, supervisorId]) => ({
        studentTreatmentId,
        supervisorId,
      }),
    );
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setError("Ora de final trebuie să fie după ora de început.");
      return;
    }
    if (
      !locationId ||
      offerings.length === 0 ||
      offerings.some((item) => !item.supervisorId)
    ) {
      setError(
        "Alege locația, cel puțin un tratament și supervizorul fiecăruia.",
      );
      return;
    }
    if (showsRecurrence && repeat !== "none") {
      if (
        recurrenceEndMode === "COUNT" &&
        (!Number.isInteger(occurrenceCount) ||
          occurrenceCount < 1 ||
          occurrenceCount > 1000)
      ) {
        setError("Numărul de apariții trebuie să fie între 1 și 1.000.");
        return;
      }
      if (recurrenceEndMode === "UNTIL" && (!endsOn || endsOn < date)) {
        setError("Data de terminare trebuie să fie după data de început.");
        return;
      }
    }
    if (affectsAppointments && reason.trim().length < 20) {
      setError(
        "Modificarea anulează cererile și programările afectate. Motivul trebuie să aibă minimum 20 de caractere.",
      );
      return;
    }

    const recurring = repeat !== "none" && (!slot || editsSeries);
    const result = await onSave({
      kind: recurring ? "RECURRING" : "SINGLE",
      scope: editScope,
      studentLocationId: locationId,
      offerings,
      startsAt,
      endsAt,
      repeat,
      recurrenceEndMode,
      occurrenceCount:
        recurring && recurrenceEndMode === "COUNT" ? occurrenceCount : null,
      endsOn: recurring && recurrenceEndMode === "UNTIL" ? endsOn : null,
      appointmentReason: affectsAppointments ? reason.trim() : null,
    });
    if (result) setError(result);
    else onOpenChange(false);
  }

  async function remove(scope: EditScope) {
    setError(null);
    const deletionAffectsAppointments =
      occupied || (scope === "SERIES" && seriesHasAppointments);
    if (deletionAffectsAppointments && reason.trim().length < 20) {
      setError("Motivul anulării trebuie să aibă minimum 20 de caractere.");
      return;
    }
    const result = await onDelete(
      scope,
      deletionAffectsAppointments ? reason.trim() : null,
    );
    if (result) setError(result);
    else onOpenChange(false);
  }

  const deleteLabel = editScope === "SERIES" ? "Șterge seria" : "Șterge apariția";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) onOpenChange(next);
        }}
      >
        <DialogContent
          ref={dialogContentRef}
          className="max-h-[90vh] max-w-2xl overflow-y-auto focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogContentRef.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {slot ? "Editează disponibilitatea" : "Adaugă disponibilitate"}
            </DialogTitle>
            <DialogDescription>
              {slot
                ? "Alege dacă modifici doar apariția selectată sau seria de la această apariție înainte."
                : "Alege unde vei fi, tratamentele oferite și supervizorul fiecăruia."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={submit}>
            {slot?.series ? (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <Label className="flex items-center gap-2" htmlFor="availability-edit-scope">
                  <Repeat2 className="size-4" />
                  Aplică acțiunea pentru
                </Label>
                <Select
                  value={editScope}
                  disabled={!editable || pending}
                  onValueChange={(value) => {
                    if (value === "OCCURRENCE" || value === "SERIES") {
                      setEditScope(value);
                    }
                  }}
                >
                  <SelectTrigger id="availability-edit-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OCCURRENCE">
                      Doar această apariție
                    </SelectItem>
                    <SelectItem value="SERIES">
                      Seria, de la această apariție
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {editScope === "SERIES"
                    ? "Salvarea înlocuiește această apariție și toate aparițiile următoare. Ștergerea elimină întreaga serie viitoare."
                    : "Schimbarea devine o excepție și nu modifică restul seriei."}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="availability-date">Data</Label>
                <Input
                  id="availability-date"
                  type="date"
                  value={date}
                  disabled={!editable || pending}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability-start">Început</Label>
                <Input
                  id="availability-start"
                  type="time"
                  step={900}
                  value={startTime}
                  disabled={!editable || pending}
                  onChange={(event) => changeStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability-end">Final</Label>
                <Input
                  id="availability-end"
                  type="time"
                  step={900}
                  value={endTime}
                  disabled={!editable || pending}
                  onChange={(event) => changeEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="size-4" />
                Locație
              </Label>
              <Select
                value={locationId}
                disabled={!editable || pending}
                onValueChange={setLocationId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Alege locația" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.locations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Stethoscope className="size-4" />
                Tratamente și supervizori
              </Label>
              {catalog.treatments.map((treatment) => {
                const fits =
                  selectedIntervalMinutes > 0 &&
                  treatment.durationMinutes <= selectedIntervalMinutes;
                const checked = fits && Object.hasOwn(selected, treatment.id);
                return (
                  <div
                    key={treatment.id}
                    className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_240px] sm:items-center ${
                      fits
                        ? ""
                        : "border-amber-500/35 bg-amber-500/5 opacity-70"
                    }`}
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!fits || !editable || pending}
                        onChange={(event) =>
                          toggleTreatment(treatment.id, event.target.checked)
                        }
                      />
                      <span>
                        <span className="block font-medium">
                          {treatment.treatment.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {treatment.durationMinutes} minute
                        </span>
                        {!fits ? (
                          <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                            {selectedIntervalMinutes > 0
                              ? `Prea lung pentru intervalul selectat (${selectedIntervalMinutes} minute disponibile).`
                              : "Alege un interval valid pentru a activa tratamentul."}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <Select
                      value={checked ? selected[treatment.id] ?? "" : ""}
                      disabled={!checked || !editable || pending}
                      onValueChange={(supervisorId) =>
                        setSelected((current) => ({
                          ...current,
                          [treatment.id]: supervisorId,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Alege supervizorul" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.supervisors.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {[item.academicTitle, item.fullName]
                              .filter(Boolean)
                              .join(" ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            {showsRecurrence ? (
              <div className="space-y-4 rounded-xl border p-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Repeat2 className="size-4" />
                    Repetare
                  </Label>
                  <Select
                    value={repeat}
                    disabled={pending}
                    onValueChange={(value) => {
                      if (
                        value === "none" ||
                        value === "weekly" ||
                        value === "biweekly"
                      ) {
                        setRepeat(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!slot ? (
                        <SelectItem value="none">Nu se repetă</SelectItem>
                      ) : null}
                      <SelectItem value="weekly">Săptămânal</SelectItem>
                      <SelectItem value="biweekly">
                        La două săptămâni
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {repeat !== "none" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="availability-recurrence-end-mode">
                        Seria se încheie
                      </Label>
                      <Select
                        value={recurrenceEndMode}
                        disabled={pending}
                        onValueChange={(value) => {
                          if (value === "COUNT" || value === "UNTIL") {
                            setRecurrenceEndMode(value);
                          }
                        }}
                      >
                        <SelectTrigger
                          id="availability-recurrence-end-mode"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COUNT">
                            După un număr de apariții
                          </SelectItem>
                          <SelectItem value="UNTIL">
                            La o anumită dată
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {recurrenceEndMode === "COUNT" ? (
                      <div className="space-y-2">
                        <Label htmlFor="availability-occurrence-count">
                          Număr de apariții
                        </Label>
                        <Input
                          id="availability-occurrence-count"
                          type="number"
                          min={1}
                          max={1000}
                          value={occurrenceCount}
                          disabled={pending}
                          onChange={(event) =>
                            setOccurrenceCount(Number(event.target.value))
                          }
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="availability-ends-on">
                          Ultima dată posibilă
                        </Label>
                        <Input
                          id="availability-ends-on"
                          type="date"
                          min={date}
                          value={endsOn}
                          disabled={pending}
                          onChange={(event) => setEndsOn(event.target.value)}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      {recurrenceEndMode === "COUNT"
                        ? `Se vor crea ${countLabel(occurrenceCount)}.`
                        : `Seria se repetă până la ${endsOn || "data aleasă"}, inclusiv.`}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {occupied || seriesHasAppointments ? (
              <div className="space-y-2">
                <Label htmlFor="availability-reason">
                  Motivul anulării programărilor
                </Label>
                <textarea
                  id="availability-reason"
                  minLength={20}
                  maxLength={500}
                  value={reason}
                  disabled={pending}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Este obligatoriu când acțiunea afectează cereri sau programări;
                  acestea sunt anulate, nu mutate.
                </p>
              </div>
            ) : null}

            {slot?.appointments.map((appointment) => {
              const reviews = appointment.patientProfile.user.reviewsReceived;
              const average = reviews.length
                ? reviews.reduce((sum, review) => sum + review.rating, 0) /
                  reviews.length
                : null;
              return (
                <div
                  key={appointment.id}
                  className="space-y-3 rounded-xl border bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-medium">
                      {appointment.patientNameSnapshot},{" "}
                      {appointment.patientAgeAtAppointment} ani
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {inputParts(new Date(appointment.scheduledStartsAt)).time}–
                      {inputParts(new Date(appointment.scheduledEndsAt)).time}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars
                      averageRating={average}
                      reviewCount={reviews.length}
                    />
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/pacienti/${appointment.patientProfile.profileSlug}#recenzii`}
                      >
                        Vezi recenziile
                      </a>
                    </Button>
                  </div>
                  {appointment.patientNote ? (
                    <p className="rounded-lg border bg-background p-3 font-semibold">
                      {appointment.patientNote}
                    </p>
                  ) : null}
                  <AppointmentActions
                    appointmentSlug={appointment.routeSlug}
                    version={appointment.version}
                    status={appointment.status}
                    role="STUDENT"
                    startsAt={appointment.scheduledStartsAt}
                    endsAt={appointment.scheduledEndsAt}
                    reviewedByActor={false}
                    onSuccess={onAppointmentChange}
                  />
                </div>
              );
            })}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter className="flex-wrap sm:justify-between">
              <div>
                {slot && editable ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => setDeleteConfirmationOpen(true)}
                  >
                    <Trash2 />
                    {deleteLabel}
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onOpenChange(false)}
                >
                  Anulează editarea
                </Button>
                {editable ? (
                  <Button type="submit" disabled={pending}>
                    <CalendarClock />
                    {slot
                      ? editScope === "SERIES"
                        ? "Salvează seria"
                        : "Salvează apariția"
                      : "Adaugă"}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmationOpen}
        onOpenChange={setDeleteConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {editScope === "SERIES"
                ? "Ștergi întreaga serie?"
                : "Ștergi această apariție?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editScope === "SERIES"
                ? "Toate aparițiile viitoare ale seriei vor dispărea din calendar. Programările afectate vor fi anulate."
                : "Apariția selectată va dispărea din calendar. Celelalte apariții ale seriei rămân neschimbate."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Păstrează</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void remove(editScope)}
            >
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
