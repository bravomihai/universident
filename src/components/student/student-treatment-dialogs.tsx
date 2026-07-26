"use client";

import { Archive, TriangleAlert } from "lucide-react";

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

type StudentTreatmentDeactivateDialogProps = {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StudentTreatmentDeactivateDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
}: StudentTreatmentDeactivateDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Tratamentul va deveni inactiv
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tratamentul nu va mai avea nicio locație activă și va fi
            dezactivat automat. Continui salvarea?
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
            Salvează și dezactivează tratamentul
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
            Tratamentul nu va mai apărea în cont și nu va mai putea
            fi selectat pentru programări. Asocierile sale cu
            locațiile vor fi arhivate. Nu îl vei putea restaura
            singur din interfață. Datele rămân păstrate pentru
            istoric și nu sunt șterse definitiv.
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
