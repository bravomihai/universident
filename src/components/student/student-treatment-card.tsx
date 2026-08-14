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
      <CardHeader className="gap-2 p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg leading-snug">{treatment.name}</CardTitle>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock3 className="size-4 stroke-[2.5]" aria-hidden="true" />
            {treatment.durationMinutes} min
          </span>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {treatment.description || treatment.catalogDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pt-0 pb-5">
        <StudentCardFeedbackMessage feedback={feedback} />
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button asChild variant="outline" size="sm"><Link href={`/cont/tratamente/${treatment.treatmentSlug}/editare`}><Pencil />Editare</Link></Button>
          <Button type="button" variant="destructive" size="sm" disabled={isDisabled} onClick={() => onArchive(treatment)}><Archive />Arhivare</Button>
        </div>
      </CardContent>
    </Card>
  );
}
