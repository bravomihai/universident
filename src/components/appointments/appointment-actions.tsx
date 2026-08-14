"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AppointmentReasonDialog,
  type AppointmentReasonAction,
} from "@/components/appointments/appointment-reason-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = "CONFIRM" | "REJECT" | "CANCEL" | "COMPLETE" | "NO_SHOW" | "REVIEW";

export function AppointmentActions({
  appointmentSlug,
  version,
  status,
  role,
  startsAt,
  endsAt,
  reviewedByActor,
  onSuccess,
}: {
  appointmentSlug: string;
  version: number;
  status: string;
  role: "PATIENT" | "STUDENT";
  startsAt: string;
  endsAt: string;
  reviewedByActor: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [reasonAction, setReasonAction] = useState<AppointmentReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const commentLength = comment.trim().length;
  const now = new Date();
  const started = new Date(startsAt) <= now;
  const ended = new Date(endsAt) <= now;

  const patientCanCancel = role === "PATIENT" && !started && (status === "PENDING" || status === "CONFIRMED");
  const studentPending = role === "STUDENT" && !started && status === "PENDING";
  const studentCanCancel = role === "STUDENT" && !started && status === "CONFIRMED";
  const studentCanFinish = role === "STUDENT" && ended && status === "CONFIRMED";
  const reviewNeeded = (status === "COMPLETED" || status === "NO_SHOW") && !reviewedByActor;

  function openReasonDialog(action: AppointmentReasonAction) {
    setError(null);
    setReasonError(null);
    setReason("");
    setReasonAction(action);
  }

  function closeReasonDialog() {
    if (pending !== null) return;
    setReasonAction(null);
    setReason("");
    setReasonError(null);
  }

  async function act(action: Action, reasonInput: string | null = null) {
    let actionReason: string | null = null;
    if (action === "REJECT" || action === "CANCEL") {
      actionReason = reasonInput?.trim() ?? "";
      if (actionReason.length < 20) {
        setReasonError("Motivul trebuie să aibă minimum 20 de caractere.");
        return;
      }
    }
    if ((action === "COMPLETE" || action === "NO_SHOW" || action === "REVIEW") && rating === null) {
      setError("Alege un rating între 1 și 5 stele.");
      return;
    }
    const trimmedComment = comment.trim();
    if (
      (action === "COMPLETE" || action === "NO_SHOW" || action === "REVIEW") &&
      trimmedComment.length > 0 &&
      trimmedComment.length < 10
    ) {
      setError("Comentariul trebuie să aibă minimum 10 caractere sau să rămână gol.");
      return;
    }

    setPending(action);
    setError(null);
    setReasonError(null);
    try {
      const reviewOnly = action === "REVIEW";
      const response = await fetch(
        reviewOnly
          ? `/api/programari/${encodeURIComponent(appointmentSlug)}/recenzie`
          : `/api/programari/${encodeURIComponent(appointmentSlug)}/actiuni`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            reviewOnly
              ? { rating, comment: trimmedComment }
              : {
                  action,
                  expectedVersion: version,
                  reason: actionReason,
                  ...(action === "COMPLETE" || action === "NO_SHOW"
                    ? { rating, comment: trimmedComment }
                    : {}),
                },
          ),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Programarea nu a putut fi actualizată.");
      setRating(null);
      setComment("");
      setReasonAction(null);
      setReason("");
      onSuccess?.();
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Programarea nu a putut fi actualizată.";
      if (action === "REJECT" || action === "CANCEL") setReasonError(message);
      else setError(message);
    } finally {
      setPending(null);
    }
  }

  const reviewFields = studentCanFinish || reviewNeeded ? (
    <div className="space-y-3 rounded-xl border border-orange-400/60 bg-orange-500/10 p-3">
      <div>
        <p className="font-medium">
          {studentCanFinish ? "Închide programarea și evaluează pacientul" : `Evaluează ${role === "PATIENT" ? "studentul" : "pacientul"}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Ratingul este obligatoriu. Comentariul este opțional; dacă îl adaugi, scrie minimum 10 caractere. Recenziile devin vizibile după ce răspund amândoi.
        </p>
      </div>
      <fieldset>
        <legend className="sr-only">Rating</legend>
        <div className="flex gap-1" aria-label="Rating de la 1 la 5 stele">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} ${value === 1 ? "stea" : "stele"}`}
              aria-pressed={rating === value}
              className="rounded-md p-1 text-orange-500 outline-none transition hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={() => setRating(value)}
            >
              <Star className={cn("size-6", rating !== null && value <= rating && "fill-current")} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Comentariu opțional</span>
        <textarea
          value={comment}
          minLength={10}
          maxLength={1000}
          rows={3}
          onChange={(event) => setComment(event.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Scrie pe scurt cum a decurs experiența."
        />
        <span
          className={cn(
            "block text-xs",
            commentLength > 0 && commentLength < 10
              ? "text-destructive"
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {commentLength === 0
            ? "Comentariul poate rămâne gol."
            : commentLength < 10
              ? `Mai scrie ${10 - commentLength} caractere.`
              : `${commentLength}/1.000 caractere`}
        </span>
      </label>
    </div>
  ) : null;

  if (!patientCanCancel && !studentPending && !studentCanCancel && !studentCanFinish && !reviewNeeded) return null;
  return (
    <div className="space-y-3">
      {reviewFields}
      <div className="flex flex-wrap gap-2">
        {studentPending ? <Button disabled={pending !== null} onClick={() => void act("CONFIRM")}>Confirmă</Button> : null}
        {studentPending ? <Button variant="destructive" disabled={pending !== null} onClick={() => openReasonDialog("REJECT")}>Respinge</Button> : null}
        {patientCanCancel || studentCanCancel ? <Button variant="destructive" disabled={pending !== null} onClick={() => openReasonDialog("CANCEL")}>Anulează</Button> : null}
        {studentCanFinish ? <Button disabled={pending !== null} onClick={() => void act("COMPLETE")}>Pacientul a venit</Button> : null}
        {studentCanFinish ? <Button variant="outline" disabled={pending !== null} onClick={() => void act("NO_SHOW")}>Nu s-a prezentat</Button> : null}
        {reviewNeeded ? <Button disabled={pending !== null} onClick={() => void act("REVIEW")}>Trimite recenzia</Button> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <AppointmentReasonDialog
        action={reasonAction}
        role={role}
        status={status}
        value={reason}
        error={reasonError}
        pending={reasonAction !== null && pending === reasonAction}
        onValueChange={(value) => { setReason(value); if (reasonError) setReasonError(null); }}
        onCancel={closeReasonDialog}
        onConfirm={() => { if (reasonAction) void act(reasonAction, reason); }}
      />
    </div>
  );
}
