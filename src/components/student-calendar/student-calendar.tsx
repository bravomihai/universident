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
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import {
  appointmentStatusLabels,
  formatAppointmentInterval,
} from "@/components/appointments/appointment-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { utcInstantForBucharestLocal } from "@/lib/availability/bucharest-time";

type CatalogItem = {
  id: string;
  studentTreatment: {
    durationMinutes: number;
    treatment: { name: string };
  };
  studentLocation: { name: string; address: string };
  supervisor: { fullName: string; academicTitle: string | null };
};

type CalendarSlot = {
  id: string;
  seriesId: string | null;
  startsAt: string;
  endsAt: string;
  originalStartsAt: string;
  status: string;
  isException: boolean;
  version: number;
  series: { revision: number } | null;
  treatmentLocation: {
    studentTreatment: { treatment: { name: string } };
    studentLocation: { name: string };
    supervisor: { fullName: string };
  };
  appointments: Array<{
    routeSlug: string;
    version: number;
    status: string;
    scheduledStartsAt: string;
    patientNameSnapshot: string;
    patientAgeAtAppointment: number;
    patientNote: string | null;
  }>;
};

type CalendarView = "timeGridDay" | "timeGridWeek";

const weekdayEnum = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const bucharestInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function bucharestInputParts(value: Date) {
  const parts = bucharestInputFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function initialDate() {
  return bucharestInputParts(new Date(Date.now() + 24 * 60 * 60 * 1000)).date;
}

function slotClassName(slot: CalendarSlot) {
  if (slot.status === "CANCELLED") return "calendar-event-cancelled";
  const appointment = slot.appointments[0];
  if (appointment?.status === "PENDING") return "calendar-event-pending";
  if (appointment?.status === "CONFIRMED") {
    return new Date(slot.endsAt) <= new Date()
      ? "calendar-event-action-required"
      : "calendar-event-confirmed";
  }
  if (slot.isException) return "calendar-event-exception";
  return "calendar-event-available";
}

function slotStatus(slot: CalendarSlot) {
  if (slot.status === "CANCELLED") return "Apariție anulată";
  const appointment = slot.appointments[0];
  if (appointment?.status === "CONFIRMED" && new Date(slot.endsAt) <= new Date()) {
    return "Necesită închidere";
  }
  if (appointment) return appointmentStatusLabels[appointment.status] ?? appointment.status;
  return slot.isException ? "Excepție mutată" : "Disponibil";
}

function slotIsMovable(slot: CalendarSlot) {
  return slot.status === "ACTIVE" && new Date(slot.startsAt) > new Date();
}

function calendarEvent(slot: CalendarSlot): EventInput {
  return {
    id: slot.id,
    title: slot.treatmentLocation.studentTreatment.treatment.name,
    start: slot.startsAt,
    end: slot.endsAt,
    editable: slotIsMovable(slot),
    startEditable: slotIsMovable(slot),
    durationEditable: false,
    classNames: [slotClassName(slot)],
    extendedProps: { slot },
  };
}

function CalendarEventContent({ event, timeText }: EventContentArg) {
  const slot = event.extendedProps.slot as CalendarSlot | undefined;
  if (!slot) return <span className="p-1 text-xs">{timeText}</span>;
  const appointment = slot.appointments[0];
  const Icon = appointment?.status === "PENDING"
    ? Clock3
    : appointment?.status === "CONFIRMED"
      ? CalendarCheck2
      : slot.isException
        ? RotateCcw
        : CheckCircle2;
  return (
    <div className="flex min-w-0 gap-1.5 p-1" data-calendar-slot-id={slot.id}>
      <Icon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[11px] font-semibold sm:text-xs">
          {slot.treatmentLocation.studentTreatment.treatment.name}
        </p>
        <p className="truncate text-[10px] opacity-85 sm:text-[11px]">
          {appointment?.patientNameSnapshot ?? slotStatus(slot)}
        </p>
        <p className="truncate text-[10px] opacity-75">{timeText}</p>
      </div>
    </div>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda calendarului">
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-emerald-500" />Disponibil</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-amber-500" />Cerere</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-blue-500" />Confirmată</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-violet-500" />Excepție</span>
    </div>
  );
}

export function StudentCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [associationId, setAssociationId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("08:00");
  const [repeat, setRepeat] = useState<"none" | "weekly" | "biweekly">("none");
  const [view, setView] = useState<CalendarView>("timeGridWeek");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const to = new Date(Date.now() + 180 * 86_400_000).toISOString();
      const response = await fetch(
        `/api/disponibilitate-student?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Calendarul nu a putut fi încărcat.");
      }
      setSlots(payload.slots);
      setCatalog(payload.catalog);
      setAssociationId((current) => current || payload.catalog[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendarul nu a putut fi încărcat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const synchronizeView = () => {
      const nextView: CalendarView = mediaQuery.matches ? "timeGridDay" : "timeGridWeek";
      const api = calendarRef.current?.getApi();
      if (api && api.view.type !== nextView) api.changeView(nextView);
      setView(nextView);
    };
    const viewTimer = window.setTimeout(synchronizeView, 0);
    mediaQuery.addEventListener("change", synchronizeView);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(viewTimer);
      mediaQuery.removeEventListener("change", synchronizeView);
    };
  }, []);

  const calendarEvents = useMemo(() => slots.map(calendarEvent), [slots]);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;

  async function create() {
    if (!associationId || !date || !time) return;
    const startMinuteOfDay = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const startsAt = utcInstantForBucharestLocal(date, startMinuteOfDay);
    if (!startsAt) return setError("Data și ora nu sunt valide în fusul Europe/Bucharest.");
    setPending(true);
    setError(null);
    setFeedback(null);
    const weekdayDate = new Date(`${date}T12:00:00Z`);
    const body = repeat === "none"
      ? { kind: "SINGLE", studentTreatmentLocationId: associationId, startsAt: startsAt.toISOString() }
      : {
          kind: "RECURRING",
          studentTreatmentLocationId: associationId,
          rule: {
            startsOn: date,
            startMinuteOfDay,
            weekdays: [weekdayEnum[weekdayDate.getUTCDay()]],
            intervalWeeks: repeat === "weekly" ? 1 : 2,
            endMode: "NEVER",
          },
        };
    try {
      const response = await fetch("/api/disponibilitate-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Disponibilitatea nu a putut fi creată.");
      setFeedback(repeat === "none" ? "Slotul a fost creat." : "Seria a fost creată pentru următoarele 180 de zile.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Disponibilitatea nu a putut fi creată.");
    } finally {
      setPending(false);
    }
  }

  async function moveSlot(slot: CalendarSlot, startsAt: Date, revert: () => void) {
    let reason: string | null = null;
    if (slot.appointments.length > 0) {
      reason = window.prompt(
        "Slotul este ocupat. Scrie motivul anulării pacientului (minimum 20 de caractere):",
      )?.trim() ?? "";
      if (reason.length < 20) {
        revert();
        setError("Mutarea a fost anulată. Motivul trebuie să aibă minimum 20 de caractere.");
        return;
      }
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/disponibilitate-student/${encodeURIComponent(slot.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "OCCURRENCE",
          startsAt: startsAt.toISOString(),
          expectedVersion: slot.version,
          appointmentReason: reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Slotul nu a putut fi mutat.");
      setFeedback("Apariția a fost mutată.");
      await load();
    } catch (caught) {
      revert();
      setError(caught instanceof Error ? caught.message : "Slotul nu a putut fi mutat.");
    } finally {
      setPending(false);
    }
  }

  async function cancelSlot(slot: CalendarSlot) {
    let reason: string | null = null;
    if (slot.appointments.length > 0) {
      reason = window.prompt(
        "Scrie motivul anulării pacientului (minimum 20 de caractere):",
      )?.trim() ?? "";
      if (reason.length < 20) return setError("Motivul trebuie să aibă minimum 20 de caractere.");
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/disponibilitate-student/${encodeURIComponent(slot.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "OCCURRENCE",
          expectedVersion: slot.version,
          appointmentReason: reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Slotul nu a putut fi anulat.");
      setSelectedSlotId(null);
      setFeedback("Apariția a fost anulată.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Slotul nu a putut fi anulat.");
    } finally {
      setPending(false);
    }
  }

  function applyCalendarDate(value: Date) {
    const input = bucharestInputParts(value);
    setDate(input.date);
    setTime(input.time);
    setFeedback("Intervalul a fost preluat în formularul de disponibilitate.");
  }

  function datesChanged(arg: DatesSetArg) {
    setCalendarTitle(arg.view.title);
    if (arg.view.type === "timeGridDay" || arg.view.type === "timeGridWeek") {
      setView(arg.view.type);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Adaugă disponibilitate</h2>
            <p className="text-sm text-muted-foreground">
              Selectează o oră în calendar sau completează manual. Fus orar: Europe/Bucharest.
            </p>
          </div>
          {catalog.length === 0 ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Activează mai întâi un tratament și asociază-i o locație și un supervizor.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Tratament · locație · supervizor</Label>
                <Select value={associationId} onValueChange={setAssociationId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {catalog.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.studentTreatment.treatment.name} · {item.studentLocation.name} · {item.supervisor.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability-date">Data</Label>
                <Input id="availability-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability-time">Ora</Label>
                <Input id="availability-time" type="time" step={900} value={time} onChange={(event) => setTime(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Repetare</Label>
                <Select value={repeat} onValueChange={(value) => {
                  if (value === "none" || value === "weekly" || value === "biweekly") setRepeat(value);
                }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nu se repetă</SelectItem>
                    <SelectItem value="weekly">Săptămânal</SelectItem>
                    <SelectItem value="biweekly">La două săptămâni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end"><Button disabled={pending} onClick={() => void create()}>Adaugă</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      {feedback ? <p role="status" className="rounded-xl border bg-card p-3 text-sm">{feedback}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-3 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CalendarLegend />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Perioada anterioară" onClick={() => calendarRef.current?.getApi().prev()}><ChevronLeft /></Button>
              <Button variant="outline" onClick={() => calendarRef.current?.getApi().today()}>Astăzi</Button>
              <Button variant="outline" size="icon" aria-label="Perioada următoare" onClick={() => calendarRef.current?.getApi().next()}><ChevronRight /></Button>
              <Select value={view} onValueChange={(nextView) => {
                if (nextView === "timeGridDay" || nextView === "timeGridWeek") calendarRef.current?.getApi().changeView(nextView);
              }}>
                <SelectTrigger className="w-36" aria-label="Vedere calendar"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="timeGridDay">Zi</SelectItem><SelectItem value="timeGridWeek">Săptămână</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <h2 className="text-center text-lg font-semibold capitalize">{calendarTitle}</h2>
          {loading ? <p className="text-sm text-muted-foreground">Se încarcă calendarul…</p> : null}
          <div className="student-calendar min-w-0">
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
              select={(selection: DateSelectArg) => {
                applyCalendarDate(selection.start);
                selection.view.calendar.unselect();
              }}
              dateClick={(click: DateClickArg) => applyCalendarDate(click.date)}
              editable
              eventDurationEditable={false}
              eventClick={(click: EventClickArg) => {
                const slot = click.event.extendedProps.slot as CalendarSlot;
                setSelectedSlotId(slot.id);
              }}
              eventDrop={(drop: EventDropArg) => {
                const slot = drop.event.extendedProps.slot as CalendarSlot;
                if (!drop.event.start) return drop.revert();
                void moveSlot(slot, drop.event.start, drop.revert);
              }}
              eventContent={(content) => <CalendarEventContent {...content} />}
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
            Selectează un interval liber pentru formular. Trage o apariție pentru a o muta; durata tratamentului rămâne neschimbată.
          </p>
        </CardContent>
      </Card>

      {selectedSlot ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">{selectedSlot.treatmentLocation.studentTreatment.treatment.name}</h2>
                <p className="text-sm text-muted-foreground">{formatAppointmentInterval(selectedSlot.startsAt, selectedSlot.endsAt)}</p>
                <p className="text-sm text-muted-foreground">{selectedSlot.treatmentLocation.studentLocation.name} · {selectedSlot.treatmentLocation.supervisor.fullName}</p>
              </div>
              <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-medium">{slotStatus(selectedSlot)}</span>
            </div>
            {selectedSlot.appointments[0] ? (
              <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{selectedSlot.appointments[0].patientNameSnapshot}, {selectedSlot.appointments[0].patientAgeAtAppointment} ani</p>
                {selectedSlot.appointments[0].patientNote ? (
                  <div className="mt-2 rounded-lg border bg-background/70 px-3 py-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mesajul pacientului</p>
                    <p className="mt-1 whitespace-pre-line font-semibold text-foreground">{selectedSlot.appointments[0].patientNote}</p>
                  </div>
                ) : null}
                <div className="mt-3">
                  <AppointmentActions
                    appointmentSlug={selectedSlot.appointments[0].routeSlug}
                    version={selectedSlot.appointments[0].version}
                    status={selectedSlot.appointments[0].status}
                    role="STUDENT"
                    startsAt={selectedSlot.appointments[0].scheduledStartsAt}
                    endsAt={selectedSlot.endsAt}
                    reviewedByActor={false}
                    onSuccess={() => void load()}
                  />
                </div>
              </div>
            ) : null}
            {selectedSlot.status === "ACTIVE" && new Date(selectedSlot.startsAt) > new Date() ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => applyCalendarDate(new Date(selectedSlot.startsAt))}>Folosește ora în formular</Button>
                <Button variant="destructive" disabled={pending} onClick={() => void cancelSlot(selectedSlot)}>Anulează apariția</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
