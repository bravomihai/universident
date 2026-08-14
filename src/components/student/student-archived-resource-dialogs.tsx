"use client";

import { RotateCcw } from "lucide-react";

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

type ArchivedLocationRestoreDialogProps = {
  locationName: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ArchivedLocationRestoreDialog({
  locationName,
  isPending,
  onCancel,
  onConfirm,
}: ArchivedLocationRestoreDialogProps) {
  return (
    <AlertDialog
      open={locationName !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <RotateCcw aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Restaurezi locația „{locationName}”?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Locația va reveni în lista obișnuită.</p>
              <p>O vei putea selecta pentru intervalele noi create în calendar.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={onConfirm}
          >
            Restaurează locația
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ArchivedTreatmentRestoreDialogProps = {
  treatmentName: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ArchivedTreatmentRestoreDialog({
  treatmentName,
  isPending,
  onCancel,
  onConfirm,
}: ArchivedTreatmentRestoreDialogProps) {
  return (
    <AlertDialog
      open={treatmentName !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <RotateCcw aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Restaurezi tratamentul „{treatmentName}”?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Tratamentul va reveni în lista obișnuită.</p>
              <p>Îl vei putea selecta pentru intervalele noi create în calendar.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={onConfirm}
          >
            Restaurează tratamentul
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ArchivedSupervisorRestoreDialogProps = {
  supervisorName: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ArchivedSupervisorRestoreDialog({
  supervisorName,
  isPending,
  onCancel,
  onConfirm,
}: ArchivedSupervisorRestoreDialogProps) {
  return (
    <AlertDialog
      open={supervisorName !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <RotateCcw aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Restaurezi profesorul „{supervisorName}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Profesorul va reveni în lista Supervizori și va putea fi selectat
            pentru tratamentele oferite într-un interval din calendar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            Restaurează supervizorul
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
