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

type StudentLocationArchiveDialogProps = {
  locationName: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StudentLocationArchiveDialog({
  locationName,
  isPending,
  onCancel,
  onConfirm,
}: StudentLocationArchiveDialogProps) {
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
            <Archive aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Arhivezi locația „{locationName}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Locația nu va mai apărea în lista obișnuită și nu va mai
            putea fi selectată în calendar. O vei
            găsi în Cont → Resurse arhivate și o vei putea restaura
            ulterior. Intervalele viitoare care folosesc locația trebuie
            eliminate înainte de arhivare.
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
            Arhivează locația
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
