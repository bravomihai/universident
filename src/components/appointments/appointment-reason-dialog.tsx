"use client";

import { Ban, CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AppointmentReasonAction = "REJECT" | "CANCEL";

export function AppointmentReasonDialog({
  action,
  role,
  status,
  value,
  error,
  pending,
  onValueChange,
  onCancel,
  onConfirm,
}: {
  action: AppointmentReasonAction | null;
  role: "PATIENT" | "STUDENT";
  status: string;
  value: string;
  error: string | null;
  pending: boolean;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isReject = action === "REJECT";
  const trimmedLength = value.trim().length;
  const remaining = Math.max(0, 20 - trimmedLength);
  const title = isReject
    ? "Respinge cererea de programare"
    : status === "PENDING"
      ? "Retrage cererea de programare"
      : "Anulează programarea";
  const description = isReject
    ? "Cererea va fi închisă, iar intervalul va redeveni disponibil pentru alți pacienți."
    : role === "PATIENT"
      ? "Studentul va fi informat, iar programarea nu va mai apărea ca activă."
      : "Pacientul va fi informat, iar programarea nu va mai apărea ca activă.";
  const fieldId = isReject ? "appointment-rejection-reason" : "appointment-cancellation-reason";
  const Icon = isReject ? Ban : CalendarX2;

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b bg-destructive/5 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-1.5">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            Motivul va fi vizibil {role === "STUDENT" ? "pacientului" : "studentului"}. Scrie clar și respectuos ce s-a întâmplat.
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {isReject ? "Motivul respingerii" : "Motivul anulării"}
            </Label>
            <textarea
              id={fieldId}
              value={value}
              minLength={20}
              maxLength={500}
              rows={5}
              disabled={pending}
              aria-invalid={Boolean(error) || (trimmedLength > 0 && remaining > 0)}
              aria-describedby={`${fieldId}-help${error ? ` ${fieldId}-error` : ""}`}
              placeholder={isReject ? "De exemplu: nu pot confirma această programare deoarece…" : "Explică pe scurt de ce anulezi programarea…"}
              onChange={(event) => onValueChange(event.target.value)}
              className="flex min-h-32 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div
              id={`${fieldId}-help`}
              className={cn(
                "flex items-center justify-between gap-3 text-xs",
                remaining > 0 && trimmedLength > 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              <span>
                {remaining > 0
                  ? remaining === 1
                    ? "Mai scrie un caracter."
                    : `Mai scrie ${remaining}${remaining === 20 ? " de" : ""} caractere.`
                  : "Motivul are lungimea necesară."}
              </span>
              <span>{value.length}/500</span>
            </div>
          </div>

          {error ? (
            <p
              id={`${fieldId}-error`}
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t bg-muted/10 px-6 py-4">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Renunță
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || remaining > 0}
            onClick={onConfirm}
          >
            {pending
              ? "Se salvează…"
              : isReject
                ? "Respinge cererea"
                : "Confirmă anularea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
