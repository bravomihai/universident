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
            putea fi folosită pentru tratamente sau programări. O vei
            găsi în Cont → Resurse arhivate și o vei putea restaura
            ulterior ca locație inactivă. Această operație poate
            dezactiva și tratamentele care nu mai au nicio altă
            locație activă.
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

type StudentLocationCascadeDialogProps = {
  affectedTreatments: {
    id: string;
    name: string;
  }[];
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StudentLocationCascadeDialog({
  affectedTreatments,
  isPending,
  onCancel,
  onConfirm,
}: StudentLocationCascadeDialogProps) {
  return (
    <AlertDialog
      open={affectedTreatments.length > 0}
      onOpenChange={(open) => {
        if (!open && !isPending) {
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
            Tratamentele afectate vor fi dezactivate
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Această operație va dezactiva și tratamentele care
                nu mai au nicio altă locație activă.
              </p>

              <div>
                <p className="font-medium text-foreground">
                  Tratamente afectate:
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {affectedTreatments.map((treatment) => (
                    <li key={treatment.id}>{treatment.name}</li>
                  ))}
                </ul>
              </div>
            </div>
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
            Continuă și dezactivează tratamentele
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
