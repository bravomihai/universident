"use client";

import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import roLocale from "@fullcalendar/core/locales/ro";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CalendarCheck2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatAppointmentInterval } from "@/components/appointments/appointment-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PublicSlot = {
  id: string;
  availabilitySlotId: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
  optimized: boolean;
  startOptions: string[];
  treatment: { name: string; slug: string; durationMinutes: number };
  location: { name: string; address: string; routeKey: string; city: { name: string } };
  supervisor: { fullName: string; academicTitle: string | null };
};
type CalendarView = "timeGridDay" | "timeGridWeek";
type PatientState = "loading" | "anonymous" | "student" | "missing-birth-date" | "ready" | "error";

const datePartsFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFormatter = new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", weekday: "short", day: "numeric", month: "short" });
const timePartsFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function localKey(date: Date) {
  const parts = datePartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayDistance(date: Date) {
  const [todayYear, todayMonth, todayDay] = localKey(new Date()).split("-").map(Number);
  const [year, month, day] = localKey(date).split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000);
}

function scrollTimeForInstant(value: string) {
  const parts = timePartsFormatter.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:00`;
}

function navigationLabel(arg: DatesSetArg) {
  if (arg.view.type === "timeGridDay") {
    const distance = dayDistance(arg.view.currentStart);
    if (distance === 0) return "Azi";
    if (distance === 1) return "Mâine";
    if (distance === 2) return "Poimâine";
    return dayLabelFormatter.format(arg.view.currentStart);
  }
  const end = new Date(arg.view.currentEnd.getTime() - 86_400_000);
  return `${dayLabelFormatter.format(arg.view.currentStart)} – ${dayLabelFormatter.format(end)}`;
}

function bookingEvent(slot: PublicSlot, selected: boolean): EventInput {
  return { id: slot.id, title: slot.treatment.name, start: slot.startsAt, end: slot.endsAt, classNames: selected ? ["calendar-event-available", "calendar-event-selected"] : ["calendar-event-available"], extendedProps: { slot, selected } };
}

function BookingEventContent({ event, timeText }: EventContentArg) {
  const slot = event.extendedProps.slot as PublicSlot;
  const selected = event.extendedProps.selected === true;
  return <div className="min-w-0 p-1 leading-tight" data-booking-slot-id={slot.id}><p className="truncate text-[11px] font-semibold sm:text-xs">{slot.treatment.name}</p><p className="truncate text-[10px] opacity-85">{slot.location.name}</p><p className="truncate text-[10px] opacity-75">{timeText}</p>{selected ? <p className="mt-0.5 text-[10px] font-bold uppercase">Selectat</p> : null}</div>;
}

export function PublicBookingPanel({ studentSlug, treatmentSlug, citySlug }: { studentSlug: string; treatmentSlug: string; citySlug: string }) {
  const calendarRef = useRef<FullCalendar>(null);
  const idempotencyKeyRef = useRef("");
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [patientState, setPatientState] = useState<PatientState>("loading");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("timeGridWeek");
  const [navLabel, setNavLabel] = useState("Azi");
  const [canGoBack, setCanGoBack] = useState(false);

  const loadAvailability = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tratament: treatmentSlug, oras: citySlug });
      const response = await fetch(`/api/studenti/${encodeURIComponent(studentSlug)}/disponibilitati?${params}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Disponibilitatea nu a putut fi încărcată.");
      setSlots(Array.isArray(payload.slots) ? payload.slots : []); setSelectedId(""); setSelectedStart(""); setBookingDialogOpen(false); idempotencyKeyRef.current = "";
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Disponibilitatea nu a putut fi încărcată.");
    } finally { setLoading(false); }
  }, [citySlug, studentSlug, treatmentSlug]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profil-pacient", { signal: controller.signal }).then(async (response) => {
      if (response.status === 401) return setPatientState("anonymous");
      if (response.status === 403) return setPatientState("student");
      const payload = await response.json();
      setPatientState(response.ok ? (payload.profile?.dateOfBirth ? "ready" : "missing-birth-date") : "error");
    }).catch(() => setPatientState("error"));
    const availabilityTimer = window.setTimeout(() => void loadAvailability(controller.signal), 0);
    const media = window.matchMedia("(max-width: 767px)");
    const synchronize = () => { const next: CalendarView = media.matches ? "timeGridDay" : "timeGridWeek"; calendarRef.current?.getApi().changeView(next); setView(next); };
    const timer = window.setTimeout(synchronize, 0); media.addEventListener("change", synchronize);
    return () => { controller.abort(); window.clearTimeout(availabilityTimer); window.clearTimeout(timer); media.removeEventListener("change", synchronize); };
  }, [loadAvailability]);

  const firstAvailableStart = slots[0]?.startOptions[0] ?? slots[0]?.startsAt ?? null;

  useEffect(() => {
    if (!firstAvailableStart || patientState === "missing-birth-date") return;
    const timer = window.setTimeout(() => {
      const calendar = calendarRef.current?.getApi();
      if (!calendar) return;
      calendar.gotoDate(firstAvailableStart);
      calendar.scrollToTime(scrollTimeForInstant(firstAvailableStart));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [firstAvailableStart, patientState]);

  const events = useMemo(() => slots.map((slot) => bookingEvent(slot, slot.id === selectedId)), [slots, selectedId]);
  const selected = slots.find((slot) => slot.id === selectedId) ?? null;

  function changeBookingDialog(open: boolean) {
    setBookingDialogOpen(open);
    if (!open) {
      setSelectedId("");
      setSelectedStart("");
      setError(null);
      idempotencyKeyRef.current = "";
    }
  }

  async function saveBirthDate() { setSavingProfile(true); setError(null); try { const response = await fetch("/api/profil-pacient", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dateOfBirth }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Data nașterii nu a putut fi salvată."); setPatientState("ready"); setDateOfBirth(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Data nașterii nu a putut fi salvată."); } finally { setSavingProfile(false); } }
  async function book() {
    if (!selected || !selectedStart || patientState !== "ready") return;
    setSubmitting(true); setError(null);
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const response = await fetch(`/api/studenti/${encodeURIComponent(studentSlug)}/programari`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: selected.availabilitySlotId, offeringId: selected.offeringId, startsAt: selectedStart, patientNote, idempotencyKey: idempotencyKeyRef.current }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Cererea nu a putut fi trimisă.");
      setCreatedSlug(payload.appointment.routeSlug); changeBookingDialog(false); await loadAvailability();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Cererea nu a putut fi trimisă."); } finally { setSubmitting(false); }
  }
  function datesChanged(arg: DatesSetArg) { setNavLabel(navigationLabel(arg)); setCanGoBack(dayDistance(arg.view.currentStart) > 0); if (arg.view.type === "timeGridDay" || arg.view.type === "timeGridWeek") setView(arg.view.type); }

  return <section aria-labelledby="booking-title" className="space-y-4">
    <div><h2 id="booking-title" className="text-2xl font-semibold">Alege o programare</h2><p className="mt-1 text-sm text-muted-foreground">Intervalul studentului este împărțit automat în ore care reduc timpul nefolosit.</p></div>
    {patientState === "missing-birth-date" ? <Card className="border-primary/40"><CardContent className="space-y-4 p-5"><div className="flex gap-3"><ShieldCheck className="size-5" /><div><p className="font-medium">Completează data nașterii</p><p className="text-sm text-muted-foreground">O păstrăm în profilul privat; studentul vede numai vârsta calculată.</p></div></div><div className="max-w-sm space-y-2"><Label htmlFor="booking-birth-date">Data nașterii</Label><Input id="booking-birth-date" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button disabled={savingProfile || !dateOfBirth} onClick={() => void saveBirthDate()}>Salvează și continuă</Button></CardContent></Card> : null}
    {createdSlug ? <Card><CardContent className="space-y-3 p-5"><p className="flex items-center gap-2 font-medium"><CalendarCheck2 className="size-5" />Cererea a fost trimisă.</p><Button asChild><Link href={`/cont/programari/${createdSlug}`}>Vezi cererea</Link></Button></CardContent></Card> : null}
    {patientState !== "missing-birth-date" ? <Card className="overflow-hidden"><CardContent className="space-y-4 p-3 sm:p-5">
      {patientState === "anonymous" ? <div className="flex items-center justify-between gap-3 rounded-xl border p-4"><p className="text-sm">Ai nevoie de un cont de pacient pentru rezervare.</p><Button asChild variant="outline" size="sm"><Link href="/autentificare">Autentifică-te</Link></Button></div> : null}
      {patientState === "student" ? <p className="rounded-xl border p-4 text-sm">Programările pot fi solicitate numai dintr-un cont de pacient.</p> : null}
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Perioada anterioară" disabled={!canGoBack} onClick={() => calendarRef.current?.getApi().prev()}><ChevronLeft /></Button><Button variant="outline" className="min-w-32" onClick={() => calendarRef.current?.getApi().today()}>{navLabel}</Button><Button variant="outline" size="icon" aria-label="Perioada următoare" onClick={() => calendarRef.current?.getApi().next()}><ChevronRight /></Button><Select value={view} onValueChange={(next) => { if (next === "timeGridDay" || next === "timeGridWeek") calendarRef.current?.getApi().changeView(next); }}><SelectTrigger className="ml-auto w-32" aria-label="Vedere calendar"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="timeGridDay">Zi</SelectItem><SelectItem value="timeGridWeek">Săptămână</SelectItem></SelectContent></Select></div>
      {loading ? <p className="text-sm text-muted-foreground">Se încarcă orele…</p> : null}{!loading && !slots.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nu există ore libere în următoarele 60 de zile.</p> : null}
      <div className="student-calendar booking-calendar min-w-0"><FullCalendar ref={calendarRef} plugins={[timeGridPlugin, interactionPlugin]} initialView={view} locale={roLocale} firstDay={1} headerToolbar={false} allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:15:00" slotLabelInterval="01:00:00" slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }} nowIndicator validRange={{ start: localKey(new Date()) }} editable={false} selectable={false} eventClick={(click: EventClickArg) => { const slot = click.event.extendedProps.slot as PublicSlot; if (patientState === "ready" || patientState === "anonymous") { setSelectedId(slot.id); setSelectedStart(slot.startOptions[0] ?? ""); idempotencyKeyRef.current = crypto.randomUUID(); setBookingDialogOpen(true); setError(null); } }} eventContent={(content) => <BookingEventContent {...content} />} events={events} datesSet={datesChanged} dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }} height="auto" expandRows scrollTime="07:00:00" scrollTimeReset={false} /></div>
    </CardContent></Card> : null}
    <Dialog open={bookingDialogOpen && Boolean(selected) && !createdSlug} onOpenChange={changeBookingDialog}><DialogContent><DialogHeader><DialogTitle>Alege ora programării</DialogTitle><DialogDescription>Selectează începutul potrivit din fereastra disponibilă și trimite cererea studentului.</DialogDescription></DialogHeader>{selected ? <div className="space-y-5"><div className="rounded-xl border bg-muted/20 p-4"><p className="font-semibold">{selected.treatment.name}</p><p className="text-sm text-muted-foreground">{selected.location.name} · {selected.location.city.name}</p><p className="text-sm text-muted-foreground">{selected.location.address}</p></div><div className="space-y-2"><Label htmlFor="booking-start">Ora de început</Label>{selected.startOptions.length === 1 ? <p id="booking-start" className="rounded-md border px-3 py-2 text-sm font-medium">{formatAppointmentInterval(selected.startOptions[0], new Date(new Date(selected.startOptions[0]).getTime() + selected.treatment.durationMinutes * 60_000).toISOString())}</p> : <Select value={selectedStart} onValueChange={(value) => { setSelectedStart(value); idempotencyKeyRef.current = crypto.randomUUID(); }}><SelectTrigger id="booking-start" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{selected.startOptions.map((start) => <SelectItem key={start} value={start}>{formatAppointmentInterval(start, new Date(new Date(start).getTime() + selected.treatment.durationMinutes * 60_000).toISOString())}</SelectItem>)}</SelectContent></Select>}</div>{patientState === "ready" ? <><div className="space-y-2"><Label htmlFor="booking-note">Mesaj pentru student (opțional)</Label><textarea id="booking-note" maxLength={1000} value={patientNote} onChange={(event) => { setPatientNote(event.target.value); idempotencyKeyRef.current = crypto.randomUUID(); }} className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm" /></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => changeBookingDialog(false)}>Anulează</Button><Button disabled={submitting || !selectedStart} onClick={() => void book()}>{submitting ? "Se trimite…" : "Trimite cererea"}</Button></DialogFooter></> : patientState === "anonymous" ? <Button asChild><Link href="/autentificare">Autentifică-te pentru rezervare</Link></Button> : null}</div> : null}</DialogContent></Dialog>
  </section>;
}
