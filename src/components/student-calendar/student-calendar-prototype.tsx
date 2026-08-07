"use client";

import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import roLocale from "@fullcalendar/core/locales/ro";
import interactionPlugin, {
  type DateClickArg,
} from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  Ban,
  CalendarCheck2,
  CalendarPlus2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  StudentAvailabilityDialog,
  type StudentAvailabilitySubmission,
} from "@/components/student-calendar/student-availability-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMockStudentCalendarEvents } from "@/lib/student-calendar/student-calendar-mock";
import {
  addMinutes,
  calendarStatusLabel,
  findCalendarConflict,
  findChangedEventsConflict,
  formatCalendarEventInterval,
  generatePrototypeOccurrenceStarts,
  humanRecurrenceDescription,
  isCalendarEventMovable,
  shiftCalendarEvent,
} from "@/lib/student-calendar/student-calendar-prototype-logic";
import type {
  StudentCalendarEvent,
  StudentCalendarMoveScope,
} from "@/lib/student-calendar/student-calendar-types";

type CalendarView = "timeGridDay" | "timeGridWeek";

type AvailabilityDialogState = {
  key: number;
  event: StudentCalendarEvent | null;
  startsAt: Date;
};

type PendingRecurringMove = {
  eventId: string;
  deltaMilliseconds: number;
  revert: () => void;
};

const conflictMessage =
  "Intervalul ales se suprapune cu un alt slot. Modificarea a fost anulată.";

function roundedNextQuarterHour() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  if (date.getHours() < 7) date.setHours(7, 0, 0, 0);
  if (date.getHours() >= 21) {
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
  }
  return date;
}

function StatusGlyph({ event }: { event: StudentCalendarEvent }) {
  const className = "mt-0.5 size-3 shrink-0";
  if (event.appointmentStatus === "pending") {
    return <Clock3 className={className} aria-hidden="true" />;
  }
  if (event.appointmentStatus === "confirmed") {
    return <CalendarCheck2 className={className} aria-hidden="true" />;
  }
  if (event.appointmentStatus === "cancelled") {
    return <Ban className={className} aria-hidden="true" />;
  }
  if (event.isException) {
    return <RotateCcw className={className} aria-hidden="true" />;
  }
  return <CheckCircle2 className={className} aria-hidden="true" />;
}

function statusClassName(event: StudentCalendarEvent) {
  if (event.appointmentStatus === "pending") return "calendar-event-pending";
  if (event.appointmentStatus === "confirmed") return "calendar-event-confirmed";
  if (event.appointmentStatus === "cancelled") return "calendar-event-cancelled";
  if (event.isException) return "calendar-event-exception";
  return "calendar-event-available";
}

function recurrenceTitle(event: StudentCalendarEvent) {
  return humanRecurrenceDescription(event.recurrence, new Date(event.originalStartsAt));
}

function displayStatus(event: StudentCalendarEvent) {
  if (event.isException && event.appointmentStatus === "available") {
    return "Excepție mutată";
  }
  return calendarStatusLabel(event.appointmentStatus);
}

function originalInterval(event: StudentCalendarEvent) {
  const originalStartsAt = new Date(event.originalStartsAt);
  const durationMilliseconds =
    new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  return formatCalendarEventInterval({
    ...event,
    startsAt: originalStartsAt.toISOString(),
    endsAt: new Date(
      originalStartsAt.getTime() + durationMilliseconds,
    ).toISOString(),
  });
}

function calendarEventInput(event: StudentCalendarEvent): EventInput {
  return {
    id: event.id,
    title: event.treatmentName,
    start: event.startsAt,
    end: event.endsAt,
    editable: isCalendarEventMovable(event),
    startEditable: isCalendarEventMovable(event),
    durationEditable: false,
    classNames: [statusClassName(event)],
    extendedProps: { studentCalendarEvent: event },
  };
}

function CalendarEventContent({ event, timeText }: EventContentArg) {
  const model = event.extendedProps.studentCalendarEvent as
    | StudentCalendarEvent
    | undefined;

  // FullCalendar folosește același renderer pentru oglinda selecției libere.
  // Acea intrare nu aparține modelului Universident și nu are extendedProps.
  if (!model) {
    return <span className="p-1 text-xs">{timeText}</span>;
  }

  return (
    <div
      className="flex min-w-0 gap-1.5 p-1"
      data-calendar-event-id={model.id}
    >
      <StatusGlyph event={model} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[11px] font-semibold sm:text-xs">
          {model.treatmentName}
        </p>
        <p className="truncate text-[10px] opacity-85 sm:text-[11px]">
          {model.isException && model.appointmentStatus === "available"
            ? "Excepție mutată"
            : calendarStatusLabel(model.appointmentStatus)}
        </p>
        <p className="truncate text-[10px] opacity-75">{timeText}</p>
      </div>
    </div>
  );
}

function CalendarLegend() {
  const items = [
    { label: "Disponibil", className: "bg-emerald-500", icon: CheckCircle2 },
    { label: "Cerere în așteptare", className: "bg-amber-500", icon: Clock3 },
    { label: "Programare confirmată", className: "bg-blue-500", icon: CalendarCheck2 },
    { label: "Excepție mutată", className: "bg-violet-500", icon: RotateCcw },
    { label: "Apariție anulată", className: "bg-slate-400", icon: Ban },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda calendarului">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex size-5 items-center justify-center rounded-md text-white ${item.className}`}>
              <Icon className="size-3" aria-hidden="true" />
            </span>
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

export function StudentCalendarPrototype() {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<StudentCalendarEvent[]>(() =>
    createMockStudentCalendarEvents(),
  );
  const [view, setView] = useState<CalendarView>("timeGridWeek");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [availabilityDialog, setAvailabilityDialog] =
    useState<AvailabilityDialogState | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] =
    useState<PendingRecurringMove | null>(null);
  const calendarEvents = useMemo(() => events.map(calendarEventInput), [events]);
  const detailEvent = events.find((event) => event.id === detailEventId) ?? null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const synchronizeView = () => {
      const nextView: CalendarView = mediaQuery.matches
        ? "timeGridDay"
        : "timeGridWeek";
      const api = calendarRef.current?.getApi();
      if (api && api.view.type !== nextView) api.changeView(nextView);
      setView(nextView);
    };

    synchronizeView();
    mediaQuery.addEventListener("change", synchronizeView);
    return () => mediaQuery.removeEventListener("change", synchronizeView);
  }, []);

  function openCreateDialog(startsAt = roundedNextQuarterHour()) {
    setFeedback(null);
    setAvailabilityDialog((current) => ({
      key: (current?.key ?? 0) + 1,
      event: null,
      startsAt,
    }));
  }

  function openEditDialog(event: StudentCalendarEvent) {
    if (!isCalendarEventMovable(event)) {
      setFeedback(
        "Sloturile cu cereri sau programări confirmate nu pot fi mutate ori editate în prototip.",
      );
      return;
    }
    setDetailEventId(null);
    setAvailabilityDialog((current) => ({
      key: (current?.key ?? 0) + 1,
      event,
      startsAt: new Date(event.startsAt),
    }));
  }

  function saveAvailability(submission: StudentAvailabilitySubmission) {
    const editedEvent = availabilityDialog?.event ?? null;

    if (editedEvent) {
      const conflict = findCalendarConflict(
        submission.startsAt,
        submission.endsAt,
        events,
        [editedEvent.id],
      );
      if (conflict) return conflictMessage;

      setEvents((current) =>
        current.map((event) =>
          event.id === editedEvent.id
            ? {
                ...event,
                startsAt: submission.startsAt.toISOString(),
                endsAt: submission.endsAt.toISOString(),
                treatmentLocationId: submission.treatmentLocationId,
                treatmentName: submission.treatmentName,
                locationName: submission.locationName,
                supervisorName: submission.supervisorName,
                recurrence: editedEvent.recurrence,
                isException: editedEvent.seriesId !== null || event.isException,
              }
            : event,
        ),
      );
      setFeedback("Apariția a fost actualizată numai în memoria prototipului.");
      return null;
    }

    const starts = generatePrototypeOccurrenceStarts(
      submission.startsAt,
      submission.recurrence,
    );
    const seriesId =
      submission.recurrence.frequency === "none"
        ? null
        : `prototype-series-${crypto.randomUUID()}`;
    const createdEvents: StudentCalendarEvent[] = starts.map((startsAt) => ({
      id: `prototype-event-${crypto.randomUUID()}`,
      seriesId,
      originalStartsAt: startsAt.toISOString(),
      startsAt: startsAt.toISOString(),
      endsAt: addMinutes(startsAt, submission.durationMinutes).toISOString(),
      treatmentLocationId: submission.treatmentLocationId,
      treatmentName: submission.treatmentName,
      locationName: submission.locationName,
      supervisorName: submission.supervisorName,
      recurrence: submission.recurrence,
      appointmentStatus: "available",
      isException: false,
    }));
    const combined = [...events];
    for (const event of createdEvents) {
      if (
        findCalendarConflict(
          new Date(event.startsAt),
          new Date(event.endsAt),
          combined,
        )
      ) {
        return conflictMessage;
      }
      combined.push(event);
    }

    setEvents(combined);
    setFeedback(
      createdEvents.length === 1
        ? "Disponibilitatea a fost adăugată local."
        : `Seria demonstrativă cu ${createdEvents.length} apariții a fost adăugată local.`,
    );
    return null;
  }

  function selectFreeInterval(selection: DateSelectArg) {
    openCreateDialog(selection.start);
    selection.view.calendar.unselect();
  }

  function clickFreeSlot(click: DateClickArg) {
    openCreateDialog(click.date);
  }

  function clickCalendarEvent(click: EventClickArg) {
    const model = click.event.extendedProps
      .studentCalendarEvent as StudentCalendarEvent;
    setFeedback(null);
    setDetailEventId(model.id);
  }

  function dropCalendarEvent(drop: EventDropArg) {
    const model = events.find((event) => event.id === drop.event.id);
    const newStart = drop.event.start;
    const newEnd = drop.event.end;
    if (!model || !newStart || !newEnd) {
      drop.revert();
      return;
    }

    if (!isCalendarEventMovable(model)) {
      drop.revert();
      setFeedback(
        "Slotul are o cerere sau o programare confirmată și nu poate fi mutat.",
      );
      return;
    }

    if (findCalendarConflict(newStart, newEnd, events, [model.id])) {
      drop.revert();
      setFeedback(conflictMessage);
      return;
    }

    const deltaMilliseconds = newStart.getTime() - new Date(model.startsAt).getTime();
    if (!model.seriesId) {
      setEvents((current) =>
        current.map((event) =>
          event.id === model.id
            ? shiftCalendarEvent(event, deltaMilliseconds, true)
            : event,
        ),
      );
      setFeedback("Slotul nerecurent a fost mutat local.");
      return;
    }

    setPendingMove({ eventId: model.id, deltaMilliseconds, revert: drop.revert });
  }

  function applyRecurringMove(scope: StudentCalendarMoveScope) {
    if (!pendingMove) return;
    const selected = events.find((event) => event.id === pendingMove.eventId);
    if (!selected?.seriesId) {
      pendingMove.revert();
      setPendingMove(null);
      return;
    }

    const selectedOriginalTime = new Date(selected.originalStartsAt).getTime();
    const changedIds = new Set<string>();
    const movedEvents = events.map((event) => {
      const sameSeries = event.seriesId === selected.seriesId;
      const shouldMove =
        scope === "occurrence"
          ? event.id === selected.id
          : scope === "series"
            ? sameSeries
            : sameSeries &&
              new Date(event.originalStartsAt).getTime() >= selectedOriginalTime;

      if (!shouldMove) return event;
      changedIds.add(event.id);
      return shiftCalendarEvent(
        event,
        pendingMove.deltaMilliseconds,
        scope !== "occurrence",
      );
    });

    if (findChangedEventsConflict(movedEvents, changedIds)) {
      pendingMove.revert();
      setPendingMove(null);
      setFeedback(conflictMessage);
      return;
    }

    setEvents(movedEvents);
    setPendingMove(null);
    setFeedback(
      scope === "occurrence"
        ? "A fost mutată numai apariția selectată și a fost marcată ca excepție."
        : scope === "following"
          ? "Au fost mutate apariția selectată și toate aparițiile ulterioare."
          : "A fost mutată întreaga serie.",
    );
  }

  function cancelPendingMove() {
    pendingMove?.revert();
    setPendingMove(null);
  }

  function cancelEvent(event: StudentCalendarEvent) {
    if (!isCalendarEventMovable(event)) {
      setFeedback("Un slot cu cerere sau programare confirmată nu poate fi anulat aici.");
      setDetailEventId(null);
      return;
    }
    setEvents((current) =>
      current.map((candidate) =>
        candidate.id === event.id
          ? {
              ...candidate,
              appointmentStatus: "cancelled",
              isException: candidate.seriesId !== null || candidate.isException,
            }
          : candidate,
      ),
    );
    setDetailEventId(null);
    setFeedback("Apariția a fost anulată în state-ul local al prototipului.");
  }

  function changeView(nextView: CalendarView) {
    calendarRef.current?.getApi().changeView(nextView);
    setView(nextView);
  }

  function datesChanged(arg: DatesSetArg) {
    setCalendarTitle(arg.view.title);
    if (arg.view.type === "timeGridDay" || arg.view.type === "timeGridWeek") {
      setView(arg.view.type);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <CalendarLegend />
        <Button onClick={() => openCreateDialog()}>
          <CalendarPlus2 aria-hidden="true" />
          Adaugă disponibilitate
        </Button>
      </div>

      {feedback ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border bg-card px-4 py-3 text-sm"
        >
          {feedback}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-3 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Perioada anterioară"
                onClick={() => calendarRef.current?.getApi().prev()}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => calendarRef.current?.getApi().today()}
              >
                Astăzi
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Perioada următoare"
                onClick={() => calendarRef.current?.getApi().next()}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>

            <h2 className="order-first text-lg font-semibold capitalize md:order-none">
              {calendarTitle}
            </h2>

            <Select value={view} onValueChange={(value) => {
              if (value === "timeGridDay" || value === "timeGridWeek") changeView(value);
            }}>
              <SelectTrigger className="w-full md:w-40" aria-label="Vedere calendar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeGridDay">Zi</SelectItem>
                <SelectItem value="timeGridWeek">Săptămână</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="student-calendar min-w-0" data-calendar-view={view}>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale={roLocale}
              firstDay={1}
              headerToolbar={false}
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              slotDuration="00:15:00"
              slotLabelInterval="01:00:00"
              slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              nowIndicator
              selectable
              selectMirror
              select={selectFreeInterval}
              dateClick={clickFreeSlot}
              editable
              eventResizableFromStart={false}
              eventDurationEditable={false}
              eventDrop={dropCalendarEvent}
              eventClick={clickCalendarEvent}
              eventContent={(arg) => <CalendarEventContent {...arg} />}
              events={calendarEvents}
              datesSet={datesChanged}
              dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
              height="auto"
              expandRows
              scrollTime="07:00:00"
              scrollTimeReset={false}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Selectează un interval liber pentru a crea un slot. Poți muta numai
            disponibilitățile fără cereri sau programări; durata rămâne cea a
            tratamentului.
          </p>
        </CardContent>
      </Card>

      {availabilityDialog ? (
        <StudentAvailabilityDialog
          key={availabilityDialog.key}
          open
          initialEvent={availabilityDialog.event}
          initialStartsAt={availabilityDialog.startsAt}
          onOpenChange={(open) => {
            if (!open) setAvailabilityDialog(null);
          }}
          onSave={saveAvailability}
        />
      ) : null}

      <Dialog
        open={detailEvent !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEventId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {detailEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailEvent.treatmentName}</DialogTitle>
                <DialogDescription>
                  {formatCalendarEventInterval(detailEvent)} · {displayStatus(detailEvent)}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 rounded-2xl border bg-muted/15 p-4 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div><dt className="text-muted-foreground">Locație</dt><dd className="font-medium">{detailEvent.locationName}</dd></div>
                </div>
                <div className="flex gap-2">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div><dt className="text-muted-foreground">Supervizor</dt><dd className="font-medium">{detailEvent.supervisorName}</dd></div>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Stethoscope className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div><dt className="text-muted-foreground">Repetare</dt><dd>{recurrenceTitle(detailEvent)}</dd></div>
                </div>
                {detailEvent.isException ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Interval inițial</dt>
                    <dd>{originalInterval(detailEvent)}</dd>
                  </div>
                ) : null}
              </dl>
              {!isCalendarEventMovable(detailEvent) ? (
                <p className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {detailEvent.appointmentStatus === "cancelled"
                    ? "Apariția este anulată și nu mai poate fi mutată sau editată."
                    : "Slotul are o cerere sau o programare confirmată. Mutarea, editarea și anularea sunt blocate în acest prototip."}
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Închide</Button></DialogClose>
                <Button
                  variant="destructive"
                  disabled={!isCalendarEventMovable(detailEvent)}
                  onClick={() => cancelEvent(detailEvent)}
                >
                  Anulează slotul
                </Button>
                <Button
                  disabled={!isCalendarEventMovable(detailEvent)}
                  onClick={() => openEditDialog(detailEvent)}
                >
                  <Pencil aria-hidden="true" /> Editează
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open) cancelPendingMove();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cum aplicăm mutarea?</DialogTitle>
            <DialogDescription>
              Slotul face parte dintr-o serie. Alege aparițiile care trebuie
              mutate în state-ul demonstrativ.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => applyRecurringMove("occurrence")}>Doar această apariție</Button>
            <Button variant="outline" onClick={() => applyRecurringMove("following")}>Aceasta și următoarele</Button>
            <Button variant="outline" onClick={() => applyRecurringMove("series")}>Toată seria</Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelPendingMove}>Renunță</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
