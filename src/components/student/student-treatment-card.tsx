"use client";

import { Archive, Clock3, Pencil } from "lucide-react";
import Link from "next/link";

import { StudentCardFeedbackMessage, type StudentCardFeedback } from "@/components/student/student-card-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StudentTreatmentCardData = {
  id: string;
  treatmentId: string;
  treatmentSlug: string;
  name: string;
  catalogDescription: string;
  description: string | null;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export function StudentTreatmentCard({ treatment, isPending, isDisabled, feedback, onArchive }: {
  treatment: StudentTreatmentCardData;
  isPending: boolean;
  isDisabled: boolean;
  feedback: StudentCardFeedback | null;
  onArchive: (treatment: StudentTreatmentCardData) => void;
}) {
  return (
    <Card aria-busy={isPending}>
      <CardHeader><CardTitle>{treatment.name}</CardTitle><CardDescription>{treatment.description || treatment.catalogDescription}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-center gap-2 text-sm"><Clock3 className="size-4" />{treatment.durationMinutes} minute</p>
        <p className="text-sm text-muted-foreground">Locația și supervizorul se aleg pentru fiecare interval direct în calendar.</p>
        <StudentCardFeedbackMessage feedback={feedback} />
        <div className="flex gap-2 border-t pt-4">
          <Button asChild variant="outline" size="sm"><Link href={`/cont/tratamente/${treatment.treatmentSlug}/editare`}><Pencil />Editare</Link></Button>
          <Button type="button" variant="destructive" size="sm" disabled={isDisabled} onClick={() => onArchive(treatment)}><Archive />Arhivare</Button>
        </div>
      </CardContent>
    </Card>
  );
}
