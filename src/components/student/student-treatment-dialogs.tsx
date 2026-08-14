"use client";

import { Archive } from "lucide-react";

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

type StudentTreatmentArchiveDialogProps = {
  treatmentName: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StudentTreatmentArchiveDialog({
  treatmentName,
  isPending,
  onCancel,
  onConfirm,
}: StudentTreatmentArchiveDialogProps) {
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
            <Archive aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Arhivezi tratamentul „{treatmentName}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tratamentul nu va mai apărea în lista obișnuită și nu va
            mai putea fi selectat în calendar. Îl vei găsi în Cont →
            Resurse arhivate și îl vei putea restaura ulterior.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            Arhivează tratamentul
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
