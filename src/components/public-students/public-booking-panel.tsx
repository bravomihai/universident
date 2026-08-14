"use client";

import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import roLocale from "@fullcalendar/core/locales/ro";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CalendarCheck2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatAppointmentInterval } from "@/components/appointments/appointment-status";
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

type PublicSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  treatmentLocation: {
    studentTreatment: { treatment: { name: string; slug: string } };
    studentLocation: { name: string; address: string; city: { name: string } };
  };
};

type CalendarView = "timeGridDay" | "timeGridWeek";
type PatientState = "loading" | "anonymous" | "student" | "missing-birth-date" | "ready" | "error";

function bookingEvent(slot: PublicSlot, selected: boolean): EventInput {
  return {
    id: slot.id,
    title: slot.treatmentLocation.studentTreatment.treatment.name,
    start: slot.startsAt,
    end: slot.endsAt,
    classNames: ["calendar-event-available", selected ? "calendar-event-selected" : ""],
    extendedProps: { slot },
  };
}

function BookingEventContent({ event, timeText }: EventContentArg) {
  const slot = event.extendedProps.slot as PublicSlot | undefined;
  if (!slot) return <span className="p-1 text-xs">{timeText}</span>;
  return (
    <div className="min-w-0 p-1 leading-tight" data-booking-slot-id={slot.id}>
      <p className="truncate text-[11px] font-semibold sm:text-xs">
        {slot.treatmentLocation.studentTreatment.treatment.name}
      </p>
      <p className="truncate text-[10px] opacity-85 sm:text-[11px]">
        {slot.treatmentLocation.studentLocation.name}
      </p>
      <p className="truncate text-[10px] opacity-75">{timeText}</p>
    </div>
  );
}

export function PublicBookingPanel({
  studentSlug,
  initialTreatmentSlug,
}: {
  studentSlug: string;
  initialTreatmentSlug?: string;
}) {
  const calendarRef = useRef<FullCalendar>(null);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [patientState, setPatientState] = useState<PatientState>("loading");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("timeGridWeek");
  const [calendarTitle, setCalendarTitle] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const profileRequest = fetch("/api/profil-pacient", { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return setPatientState("anonymous");
        if (response.status === 403) return setPatientState("student");
        const payload = await response.json();
        if (!response.ok) return setPatientState("error");
        setPatientState(payload.profile?.dateOfBirth ? "ready" : "missing-birth-date");
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setPatientState("error");
        }
      });
    const availabilityRequest = fetch(
      `/api/studenti/${encodeURIComponent(studentSlug)}/disponibilitati`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Disponibilitatea nu a putut fi încărcată.");
        setSlots(payload.slots);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Disponibilitatea nu a putut fi încărcată.");
      })
      .finally(() => setLoading(false));

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const synchronizeView = () => {
      const nextView: CalendarView = mediaQuery.matches ? "timeGridDay" : "timeGridWeek";
      const api = calendarRef.current?.getApi();
      if (api && api.view.type !== nextView) api.changeView(nextView);
      setView(nextView);
    };
    const viewTimer = window.setTimeout(synchronizeView, 0);
    mediaQuery.addEventListener("change", synchronizeView);
    void Promise.all([profileRequest, availabilityRequest]);
    return () => {
      controller.abort();
      window.clearTimeout(viewTimer);
      mediaQuery.removeEventListener("change", synchronizeView);
    };
  }, [studentSlug]);

  const visibleSlots = useMemo(
    () => initialTreatmentSlug
      ? slots.filter((slot) => slot.treatmentLocation.studentTreatment.treatment.slug === initialTreatmentSlug)
      : slots,
    [initialTreatmentSlug, slots],
  );
  const events = useMemo(
    () => visibleSlots.map((slot) => bookingEvent(slot, slot.id === selectedId)),
    [selectedId, visibleSlots],
  );
  const selectedSlot = visibleSlots.find((slot) => slot.id === selectedId) ?? null;

  async function saveBirthDate() {
    setSavingProfile(true);
    setError(null);
    try {
      const response = await fetch("/api/profil-pacient", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Data nașterii nu a putut fi salvată.");
      setPatientState("ready");
      setDateOfBirth("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data nașterii nu a putut fi salvată.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function book() {
    if (!selectedId) return setError("Alege un interval disponibil din calendar.");
    if (patientState !== "ready") return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/studenti/${encodeURIComponent(studentSlug)}/programari`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedId, patientNote }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Cererea nu a putut fi trimisă.");
      setCreatedSlug(payload.appointment.routeSlug);
      setSlots((current) => current.filter((slot) => slot.id !== selectedId));
      setSelectedId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cererea nu a putut fi trimisă.");
    } finally {
      setSubmitting(false);
    }
  }

  function datesChanged(arg: DatesSetArg) {
    setCalendarTitle(arg.view.title);
    if (arg.view.type === "timeGridDay" || arg.view.type === "timeGridWeek") {
      setView(arg.view.type);
    }
  }

  return (
    <section id="programare" aria-labelledby="programare-title" className="space-y-4">
      <div>
        <h2 id="programare-title" className="text-2xl font-semibold tracking-tight">Alege o programare</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selectează un interval verde din calendar. Cererea rămâne în așteptare până la confirmarea studentului.
        </p>
      </div>

      {patientState === "missing-birth-date" ? (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 p-5">
            <div className="flex gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-primary/10"><ShieldCheck className="size-4" /></span>
              <div><p className="font-medium">Completează data nașterii înainte de a alege ora</p><p className="text-sm text-muted-foreground">O cerem o singură dată și o păstrăm în profilul privat. Studentul vede numai vârsta calculată.</p></div>
            </div>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="booking-birth-date">Data nașterii</Label>
              <Input id="booking-birth-date" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              <p className="text-xs text-muted-foreground">Trebuie să ai cel puțin 18 ani. Dacă ai introdus greșit data, o poți corecta aici sau ulterior din profil.</p>
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={savingProfile || !dateOfBirth} onClick={() => void saveBirthDate()}>{savingProfile ? "Se salvează…" : "Salvează și continuă"}</Button>
          </CardContent>
        </Card>
      ) : null}

      {createdSlug ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 font-medium"><CalendarCheck2 className="size-5" />Cererea a fost trimisă.</p>
            <p className="text-sm text-muted-foreground">O vei vedea în cont, iar intervalul devine confirmat numai după acceptarea studentului.</p>
            <Button asChild><Link href={`/cont/programari/${createdSlug}`}>Vezi cererea</Link></Button>
          </CardContent>
        </Card>
      ) : patientState !== "missing-birth-date" ? (
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-3 sm:p-5">
            {patientState === "anonymous" ? (
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium">Ai nevoie de un cont de pacient pentru rezervare.</p><p className="text-sm text-muted-foreground">Poți consulta calendarul acum și te poți autentifica înainte să trimiți cererea.</p></div>
                <Button asChild variant="outline" size="sm"><Link href="/autentificare">Autentifică-te</Link></Button>
              </div>
            ) : null}
            {patientState === "student" ? <p className="rounded-xl border bg-muted/20 p-4 text-sm">Programările pot fi solicitate numai dintr-un cont de pacient.</p> : null}
            {patientState === "error" ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Profilul pacientului nu a putut fi verificat. Reîncarcă pagina.</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Perioada anterioară" onClick={() => calendarRef.current?.getApi().prev()}><ChevronLeft /></Button>
                <Button variant="outline" onClick={() => calendarRef.current?.getApi().today()}>Astăzi</Button>
                <Button variant="outline" size="icon" aria-label="Perioada următoare" onClick={() => calendarRef.current?.getApi().next()}><ChevronRight /></Button>
              </div>
              <Select value={view} onValueChange={(nextView) => {
                if (nextView === "timeGridDay" || nextView === "timeGridWeek") calendarRef.current?.getApi().changeView(nextView);
              }}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Vedere calendar"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="timeGridDay">Zi</SelectItem><SelectItem value="timeGridWeek">Săptămână</SelectItem></SelectContent>
              </Select>
            </div>
            <h3 className="text-center text-lg font-semibold capitalize">{calendarTitle}</h3>
            {loading || patientState === "loading" ? <p className="text-sm text-muted-foreground">Se încarcă programările disponibile…</p> : null}
            {!loading && visibleSlots.length === 0 ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Nu există intervale libere în următoarele 60 de zile.</p> : null}
            <div className="student-calendar booking-calendar min-w-0">
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, interactionPlugin]}
                initialView={view}
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
                editable={false}
                selectable={false}
                eventClick={(click: EventClickArg) => {
                  const slot = click.event.extendedProps.slot as PublicSlot;
                  if (patientState === "ready" || patientState === "anonymous") {
                    setSelectedId(slot.id);
                    setError(null);
                  }
                }}
                eventContent={(content) => <BookingEventContent {...content} />}
                events={events}
                datesSet={datesChanged}
                dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
                height="auto"
                expandRows
                scrollTime="07:00:00"
                scrollTimeReset={false}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedSlot && !createdSlug ? (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="font-semibold">{selectedSlot.treatmentLocation.studentTreatment.treatment.name}</p>
              <p className="text-sm text-muted-foreground">{formatAppointmentInterval(selectedSlot.startsAt, selectedSlot.endsAt)}</p>
              <p className="text-sm text-muted-foreground">{selectedSlot.treatmentLocation.studentLocation.name} · {selectedSlot.treatmentLocation.studentLocation.city.name}</p>
              <p className="text-sm text-muted-foreground">{selectedSlot.treatmentLocation.studentLocation.address}</p>
            </div>
            {patientState === "ready" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="booking-note">Mesaj pentru student (opțional)</Label>
                  <textarea id="booking-note" maxLength={1000} value={patientNote} onChange={(event) => setPatientNote(event.target.value)} className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm" />
                </div>
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <Button disabled={submitting} onClick={() => void book()}>{submitting ? "Se trimite…" : "Trimite cererea"}</Button>
              </>
            ) : patientState === "anonymous" ? (
              <Button asChild><Link href="/autentificare">Autentifică-te pentru rezervare</Link></Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
