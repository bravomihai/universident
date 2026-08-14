"use client";

import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import roLocale from "@fullcalendar/core/locales/ro";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Pencil, Repeat2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { StudentAvailabilityEditorDialog } from "@/components/student-calendar/student-availability-editor-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AvailabilityCatalog = {
  locations: Array<{ id: string; name: string; address: string; city: { name: string } }>;
  treatments: Array<{ id: string; durationMinutes: number; treatment: { name: string; slug: string } }>;
  supervisors: Array<{ id: string; fullName: string; academicTitle: string | null }>;
};
export type CalendarSlot = {
  id: string;
  seriesId: string | null;
  sequenceNumber: number | null;
  startsAt: string;
  endsAt: string;
  status: string;
  isException: boolean;
  version: number;
  series: {
    revision: number;
    intervalWeeks: number;
    endMode: "NEVER" | "UNTIL" | "COUNT";
    endsOn: string | null;
    occurrenceCount: number | null;
  } | null;
  studentLocation: { id: string; name: string; address: string; city: { name: string } };
  offerings: Array<{ id: string; studentTreatment: { id: string; durationMinutes: number; treatment: { name: string; slug: string } }; supervisor: { id: string; fullName: string; academicTitle: string | null } }>;
  appointments: Array<{
    id: string; routeSlug: string; version: number; status: string; scheduledStartsAt: string; scheduledEndsAt: string; patientNameSnapshot: string; patientAgeAtAppointment: number; patientNote: string | null;
    patientProfile: { profileSlug: string; user: { reviewsReceived: Array<{ rating: number }> } };
  }>;
};
type CalendarView = "timeGridDay" | "timeGridWeek";
type DraftRange = { startsAt: Date; endsAt: Date };

const weekdayEnum = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const datePartsFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFormatter = new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", weekday: "short", day: "numeric", month: "short" });
function localKey(date: Date) { const parts = datePartsFormatter.formatToParts(date); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""; return `${get("year")}-${get("month")}-${get("day")}`; }
function distanceFromToday(date: Date) { const parse = (value: string) => value.split("-").map(Number); const [ty, tm, td] = parse(localKey(new Date())); const [y, m, d] = parse(localKey(date)); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000); }
function navigationLabel(arg: DatesSetArg) { if (arg.view.type === "timeGridDay") { const distance = distanceFromToday(arg.view.currentStart); if (distance === 0) return "Azi"; if (distance === 1) return "Mâine"; if (distance === 2) return "Poimâine"; return dayLabelFormatter.format(arg.view.currentStart); } return `${dayLabelFormatter.format(arg.view.currentStart)} – ${dayLabelFormatter.format(new Date(arg.view.currentEnd.getTime() - 86_400_000))}`; }
function slotClass(slot: CalendarSlot, selected: boolean) { if (selected) return "calendar-event-selected"; if (slot.appointments.some((item) => item.status === "PENDING")) return "calendar-event-pending"; if (slot.appointments.some((item) => item.status === "CONFIRMED")) return "calendar-event-confirmed"; if (slot.isException) return "calendar-event-exception"; return "calendar-event-available"; }
function eventFor(slot: CalendarSlot, selected: boolean): EventInput { return { id: slot.id, title: slot.studentLocation.name, start: slot.startsAt, end: slot.endsAt, classNames: [slotClass(slot, selected)], extendedProps: { slot, selected } }; }
function EventContent({ event, timeText }: EventContentArg) {
  const slot = event.extendedProps.slot as CalendarSlot | undefined;
  if (!slot) return <div className="p-1 text-xs font-semibold">Selectat · {timeText}</div>;
  const selected = event.extendedProps.selected === true;
  const pendingAppointment = slot.appointments.some((item) => item.status === "PENDING");
  const confirmedAppointment = slot.appointments.some((item) => item.status === "CONFIRMED");
  const Icon = pendingAppointment
    ? Clock3
    : confirmedAppointment
      ? CalendarCheck2
      : slot.isException
        ? Pencil
        : slot.seriesId
          ? Repeat2
          : CheckCircle2;
  const iconLabel = pendingAppointment
    ? "Cerere în așteptare"
    : confirmedAppointment
      ? "Programare confirmată"
      : slot.isException
        ? "Apariție recurentă modificată separat"
        : slot.seriesId
          ? "Apariție recurentă"
          : "Disponibilitate unică";
  return <div className="flex min-w-0 gap-1.5 p-1"><span className="mt-0.5 shrink-0" title={iconLabel} aria-label={iconLabel}><Icon className="size-3" aria-hidden="true" /></span><div className="min-w-0 leading-tight"><p className="truncate text-[11px] font-semibold">{slot.studentLocation.name}</p><p className="truncate text-[10px]">{slot.offerings.map((item) => item.studentTreatment.treatment.name).join(", ")}</p><p className="truncate text-[10px] opacity-75">{timeText}</p>{selected ? <p className="text-[10px] font-bold uppercase">Selectat</p> : null}</div></div>;
}

export function StudentCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [catalog, setCatalog] = useState<AvailabilityCatalog>({ locations: [], treatments: [], supervisors: [] });
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [feedback, setFeedback] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("timeGridWeek"); const [navLabel, setNavLabel] = useState("Azi"); const [canGoBack, setCanGoBack] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null); const [draft, setDraft] = useState<DraftRange | null>(null); const [dialogOpen, setDialogOpen] = useState(false);

  async function load() { setLoading(true); setError(null); try { const from = new Date(Date.now() - 30 * 86_400_000).toISOString(); const to = new Date(Date.now() + 180 * 86_400_000).toISOString(); const response = await fetch(`/api/disponibilitate-student?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Calendarul nu a putut fi încărcat."); setSlots(payload.slots); setCatalog(payload.catalog); } catch (caught) { setError(caught instanceof Error ? caught.message : "Calendarul nu a putut fi încărcat."); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); const media = window.matchMedia("(max-width: 767px)"); const sync = () => { const next: CalendarView = media.matches ? "timeGridDay" : "timeGridWeek"; calendarRef.current?.getApi().changeView(next); setView(next); }; const viewTimer = window.setTimeout(sync, 0); media.addEventListener("change", sync); return () => { window.clearTimeout(timer); window.clearTimeout(viewTimer); media.removeEventListener("change", sync); }; }, []);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const events = useMemo(() => { const result = slots.map((slot) => eventFor(slot, slot.id === selectedSlotId)); if (draft && !selectedSlotId) result.push({ id: "draft-selection", title: "Selectat", start: draft.startsAt, end: draft.endsAt, classNames: ["calendar-event-selected"], extendedProps: { selected: true } }); return result; }, [slots, selectedSlotId, draft]);
  const range = selectedSlot ? { startsAt: new Date(selectedSlot.startsAt), endsAt: new Date(selectedSlot.endsAt) } : draft;
  function closeDialog(open: boolean) { setDialogOpen(open); if (!open) { setDraft(null); setSelectedSlotId(null); } }
  function openRange(startsAt: Date, endsAt: Date) { if (startsAt <= new Date()) { setError("Alege un interval viitor."); return; } setSelectedSlotId(null); setDraft({ startsAt, endsAt }); setDialogOpen(true); setFeedback(null); }
  async function save(payload: { kind: "SINGLE" | "RECURRING"; scope: "OCCURRENCE" | "SERIES"; studentLocationId: string; offerings: Array<{ studentTreatmentId: string; supervisorId: string }>; startsAt: Date; endsAt: Date; repeat: "none" | "weekly" | "biweekly"; recurrenceEndMode: "COUNT" | "UNTIL"; occurrenceCount: number | null; endsOn: string | null; appointmentReason: string | null }) {
    setPending(true); setError(null);
    const parts = localKey(payload.startsAt); const localTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(payload.startsAt); const startMinuteOfDay = Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3, 5)); const durationMinutes = Math.round((payload.endsAt.getTime() - payload.startsAt.getTime()) / 60_000);
    const rule = payload.kind === "RECURRING" ? { startsOn: parts, startMinuteOfDay, durationMinutes, weekdays: [weekdayEnum[new Date(`${parts}T12:00:00Z`).getUTCDay()]], intervalWeeks: payload.repeat === "weekly" ? 1 : 2, endMode: payload.recurrenceEndMode, endsOn: payload.endsOn, occurrenceCount: payload.occurrenceCount } : null;
    const body = selectedSlot
      ? { scope: payload.scope, studentLocationId: payload.studentLocationId, offerings: payload.offerings, startsAt: payload.startsAt.toISOString(), endsAt: payload.endsAt.toISOString(), expectedVersion: selectedSlot.version, expectedSeriesRevision: payload.scope === "SERIES" ? selectedSlot.series?.revision : null, rule: payload.scope === "SERIES" ? rule : null, appointmentReason: payload.appointmentReason }
      : payload.kind === "SINGLE"
        ? { kind: "SINGLE", studentLocationId: payload.studentLocationId, offerings: payload.offerings, startsAt: payload.startsAt.toISOString(), endsAt: payload.endsAt.toISOString() }
        : { kind: "RECURRING", studentLocationId: payload.studentLocationId, offerings: payload.offerings, rule };
    try { const response = await fetch(selectedSlot ? `/api/disponibilitate-student/${encodeURIComponent(selectedSlot.id)}` : "/api/disponibilitate-student", { method: selectedSlot ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) return result.error ?? "Disponibilitatea nu a putut fi salvată."; setFeedback(selectedSlot ? payload.scope === "SERIES" ? "Seria a fost actualizată de la apariția selectată." : "Apariția a fost actualizată." : payload.kind === "SINGLE" ? "Intervalul a fost adăugat." : "Seria a fost adăugată."); await load(); return null; } catch { return "Disponibilitatea nu a putut fi salvată."; } finally { setPending(false); }
  }
  async function remove(scope: "OCCURRENCE" | "SERIES", reason: string | null) { if (!selectedSlot) return "Apariția nu a fost găsită."; setPending(true); try { const response = await fetch(`/api/disponibilitate-student/${encodeURIComponent(selectedSlot.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, expectedVersion: selectedSlot.version, expectedSeriesRevision: scope === "SERIES" ? selectedSlot.series?.revision : null, appointmentReason: reason }) }); const result = await response.json(); if (!response.ok) return result.error ?? "Apariția nu a putut fi ștearsă."; setFeedback(scope === "SERIES" ? "Seria a fost ștearsă din calendar." : "Apariția a fost ștearsă din calendar."); await load(); return null; } catch { return "Apariția nu a putut fi ștearsă."; } finally { setPending(false); } }
  function datesChanged(arg: DatesSetArg) { setNavLabel(navigationLabel(arg)); setCanGoBack(distanceFromToday(arg.view.currentStart) > 0); if (arg.view.type === "timeGridDay" || arg.view.type === "timeGridWeek") setView(arg.view.type); }
  const ready = catalog.locations.length > 0 && catalog.treatments.length > 0 && catalog.supervisors.length > 0;

  return <div className="space-y-5">
    {!ready && !loading ? <Card><CardContent className="space-y-3 p-5"><p className="font-medium">Completează resursele înainte de a adăuga disponibilitate.</p><div className="flex flex-wrap gap-2">{!catalog.treatments.length ? <Button asChild variant="outline" size="sm"><Link href="/cont/tratamente">Gestionează tratamentele</Link></Button> : null}{!catalog.locations.length ? <Button asChild variant="outline" size="sm"><Link href="/cont/locatii">Gestionează locațiile</Link></Button> : null}{!catalog.supervisors.length ? <Button asChild variant="outline" size="sm"><Link href="/cont/supervizori">Gestionează supervizorii</Link></Button> : null}</div></CardContent></Card> : null}
    {feedback ? <p role="status" className="rounded-xl border bg-card p-3 text-sm">{feedback}</p> : null}{error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    <Card className="overflow-hidden"><CardContent className="space-y-4 p-3 sm:p-5"><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Perioada anterioară" disabled={!canGoBack} onClick={() => calendarRef.current?.getApi().prev()}><ChevronLeft /></Button><Button variant="outline" className="min-w-32" onClick={() => calendarRef.current?.getApi().today()}>{navLabel}</Button><Button variant="outline" size="icon" aria-label="Perioada următoare" onClick={() => calendarRef.current?.getApi().next()}><ChevronRight /></Button><Select value={view} onValueChange={(next) => { if (next === "timeGridDay" || next === "timeGridWeek") calendarRef.current?.getApi().changeView(next); }}><SelectTrigger className="ml-auto w-32" aria-label="Vedere calendar"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="timeGridDay">Zi</SelectItem><SelectItem value="timeGridWeek">Săptămână</SelectItem></SelectContent></Select></div>{loading ? <p className="text-sm text-muted-foreground">Se încarcă calendarul…</p> : null}<div className="student-calendar min-w-0"><FullCalendar ref={calendarRef} plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" locale={roLocale} firstDay={1} headerToolbar={false} allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:15:00" slotLabelInterval="01:00:00" slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }} nowIndicator validRange={{ start: localKey(new Date()) }} selectable={ready} selectMirror select={(selection: DateSelectArg) => { openRange(selection.start, selection.end); selection.view.calendar.unselect(); }} dateClick={(click: DateClickArg) => { if (ready) openRange(click.date, new Date(click.date.getTime() + 60 * 60_000)); }} editable={false} eventClick={(click: EventClickArg) => { const slot = click.event.extendedProps.slot as CalendarSlot; setDraft(null); setSelectedSlotId(slot.id); setDialogOpen(true); }} eventContent={(content) => <EventContent {...content} />} events={events} datesSet={datesChanged} dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }} height="auto" expandRows scrollTime="07:00:00" scrollTimeReset={false} /></div></CardContent></Card>
    {dialogOpen && range ? <StudentAvailabilityEditorDialog key={`${selectedSlotId ?? "new"}:${range.startsAt.toISOString()}`} open={dialogOpen} catalog={catalog} slot={selectedSlot} range={range} pending={pending} seriesHasAppointments={Boolean(selectedSlot?.seriesId && slots.some((slot) => slot.seriesId === selectedSlot.seriesId && slot.appointments.length > 0))} onOpenChange={closeDialog} onSave={save} onDelete={remove} onAppointmentChange={() => void load()} /> : null}
  </div>;
}
