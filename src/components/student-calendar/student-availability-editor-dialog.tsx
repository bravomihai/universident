"use client";

import { CalendarClock, MapPin, Repeat2, Stethoscope } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { RatingStars } from "@/components/reviews/rating-summary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AvailabilityCatalog, CalendarSlot } from "@/components/student-calendar/student-calendar";
import { utcInstantForBucharestLocal } from "@/lib/availability/bucharest-time";

type Range = { startsAt: Date; endsAt: Date };
type SavePayload = {
  kind: "SINGLE" | "RECURRING";
  studentLocationId: string;
  offerings: Array<{ studentTreatmentId: string; supervisorId: string }>;
  startsAt: Date;
  endsAt: Date;
  repeat: "none" | "weekly" | "biweekly";
  appointmentReason: string | null;
};

const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function inputParts(value: Date) { const parts = formatter.formatToParts(value); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }; }

export function StudentAvailabilityEditorDialog({ open, catalog, slot, range, pending, onOpenChange, onSave, onDelete, onAppointmentChange }: {
  open: boolean;
  catalog: AvailabilityCatalog;
  slot: CalendarSlot | null;
  range: Range;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SavePayload) => Promise<string | null>;
  onDelete: (scope: "OCCURRENCE" | "SERIES", reason: string | null) => Promise<string | null>;
  onAppointmentChange: () => void;
}) {
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const start = inputParts(range.startsAt); const end = inputParts(range.endsAt);
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [locationId, setLocationId] = useState(slot?.studentLocation.id ?? catalog.locations[0]?.id ?? "");
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(slot?.offerings.map((offering) => [offering.studentTreatment.id, offering.supervisor.id]) ?? []));
  const [repeat, setRepeat] = useState<"none" | "weekly" | "biweekly">("none");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const occupied = Boolean(slot?.appointments.length);
  const editable = !slot || (slot.status === "ACTIVE" && range.startsAt > new Date());

  function toggleTreatment(id: string, checked: boolean) { setSelected((current) => { const next = { ...current }; if (checked) next[id] = next[id] || catalog.supervisors[0]?.id || ""; else delete next[id]; return next; }); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const startsAt = utcInstantForBucharestLocal(date, Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)));
    const endsAt = utcInstantForBucharestLocal(date, Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5)));
    const offerings = Object.entries(selected).map(([studentTreatmentId, supervisorId]) => ({ studentTreatmentId, supervisorId }));
    if (!startsAt || !endsAt || endsAt <= startsAt) return setError("Ora de final trebuie să fie după ora de început.");
    if (!locationId || offerings.length === 0 || offerings.some((item) => !item.supervisorId)) return setError("Alege locația, cel puțin un tratament și supervizorul fiecăruia.");
    if (occupied && reason.trim().length < 20) return setError("Modificarea anulează cererile și programările din interval. Motivul trebuie să aibă minimum 20 de caractere.");
    const result = await onSave({ kind: repeat === "none" ? "SINGLE" : "RECURRING", studentLocationId: locationId, offerings, startsAt, endsAt, repeat, appointmentReason: occupied ? reason.trim() : null });
    if (result) setError(result); else onOpenChange(false);
  }
  async function remove(scope: "OCCURRENCE" | "SERIES") { setError(null); if (occupied && reason.trim().length < 20) return setError("Motivul anulării trebuie să aibă minimum 20 de caractere."); const result = await onDelete(scope, occupied ? reason.trim() : null); if (result) setError(result); else onOpenChange(false); }

  return <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}><DialogContent ref={dialogContentRef} className="max-h-[90vh] max-w-2xl overflow-y-auto focus:outline-none" onOpenAutoFocus={(event) => { event.preventDefault(); dialogContentRef.current?.focus({ preventScroll: true }); }}>
    <DialogHeader><DialogTitle>{slot ? "Editează apariția" : "Adaugă disponibilitate"}</DialogTitle><DialogDescription>{slot ? "Modificarea se aplică apariției selectate. Apasă în afara dialogului sau Anulează editarea pentru a-l închide." : "Alege unde vei fi, tratamentele oferite și supervizorul fiecăruia."}</DialogDescription></DialogHeader>
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="availability-date">Data</Label><Input id="availability-date" type="date" value={date} disabled={!editable || pending} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="availability-start">Început</Label><Input id="availability-start" type="time" step={900} value={startTime} disabled={!editable || pending} onChange={(event) => setStartTime(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="availability-end">Final</Label><Input id="availability-end" type="time" step={900} value={endTime} disabled={!editable || pending} onChange={(event) => setEndTime(event.target.value)} /></div></div>
      <div className="space-y-2"><Label className="flex items-center gap-2"><MapPin className="size-4" />Locație</Label><Select value={locationId} disabled={!editable || pending} onValueChange={setLocationId}><SelectTrigger className="w-full"><SelectValue placeholder="Alege locația" /></SelectTrigger><SelectContent>{catalog.locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.city.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-3"><Label className="flex items-center gap-2"><Stethoscope className="size-4" />Tratamente și supervizori</Label>{catalog.treatments.map((treatment) => { const checked = Object.hasOwn(selected, treatment.id); return <div key={treatment.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_240px] sm:items-center"><label className="flex items-center gap-3"><input type="checkbox" checked={checked} disabled={!editable || pending} onChange={(event) => toggleTreatment(treatment.id, event.target.checked)} /><span><span className="block font-medium">{treatment.treatment.name}</span><span className="text-xs text-muted-foreground">{treatment.durationMinutes} minute</span></span></label><Select value={selected[treatment.id] ?? ""} disabled={!checked || !editable || pending} onValueChange={(supervisorId) => setSelected((current) => ({ ...current, [treatment.id]: supervisorId }))}><SelectTrigger className="w-full"><SelectValue placeholder="Alege supervizorul" /></SelectTrigger><SelectContent>{catalog.supervisors.map((item) => <SelectItem key={item.id} value={item.id}>{[item.academicTitle, item.fullName].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent></Select></div>; })}</div>
      {!slot ? <div className="space-y-2"><Label className="flex items-center gap-2"><Repeat2 className="size-4" />Repetare</Label><Select value={repeat} disabled={pending} onValueChange={(value) => { if (value === "none" || value === "weekly" || value === "biweekly") setRepeat(value); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nu se repetă</SelectItem><SelectItem value="weekly">Săptămânal</SelectItem><SelectItem value="biweekly">La două săptămâni</SelectItem></SelectContent></Select></div> : null}
      {occupied ? <div className="space-y-2"><Label htmlFor="availability-reason">Motivul anulării programărilor</Label><textarea id="availability-reason" minLength={20} maxLength={500} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm" /><p className="text-xs text-muted-foreground">Orice modificare a unei apariții ocupate anulează programările din ea; acestea nu sunt mutate.</p></div> : null}
      {slot?.appointments.map((appointment) => { const reviews = appointment.patientProfile.user.reviewsReceived; const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null; return <div key={appointment.id} className="space-y-3 rounded-xl border bg-muted/20 p-4"><div><p className="font-medium">{appointment.patientNameSnapshot}, {appointment.patientAgeAtAppointment} ani</p><p className="text-sm text-muted-foreground">{inputParts(new Date(appointment.scheduledStartsAt)).time}–{inputParts(new Date(appointment.scheduledEndsAt)).time}</p></div><div className="flex flex-wrap items-center gap-2"><RatingStars averageRating={average} reviewCount={reviews.length} /><Button asChild variant="outline" size="sm"><a href={`/pacienti/${appointment.patientProfile.profileSlug}#recenzii`}>Vezi recenziile</a></Button></div>{appointment.patientNote ? <p className="rounded-lg border bg-background p-3 font-semibold">{appointment.patientNote}</p> : null}<AppointmentActions appointmentSlug={appointment.routeSlug} version={appointment.version} status={appointment.status} role="STUDENT" startsAt={appointment.scheduledStartsAt} endsAt={appointment.scheduledEndsAt} reviewedByActor={false} onSuccess={onAppointmentChange} /></div>; })}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter className="flex-wrap sm:justify-between"><div className="flex flex-wrap gap-2">{slot && editable ? <><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove("OCCURRENCE")}>Șterge apariția</Button>{slot.series ? <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove("SERIES")}>Șterge seria</Button> : null}</> : null}</div><div className="flex gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Anulează editarea</Button>{editable ? <Button type="submit" disabled={pending}><CalendarClock />{slot ? "Salvează" : "Adaugă"}</Button> : null}</div></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
