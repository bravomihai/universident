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
    <Card size="sm" className="h-fit self-start" aria-busy={isPending}>
      <CardHeader className="gap-1.5">
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
      <CardContent className="space-y-2">
        <StudentCardFeedbackMessage feedback={feedback} />
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <Button asChild variant="outline" className="w-full"><Link href={`/cont/tratamente/${treatment.treatmentSlug}/editare`}><Pencil />Editare</Link></Button>
          <Button type="button" variant="destructive" className="w-full" disabled={isDisabled} onClick={() => onArchive(treatment)}><Archive />Arhivare</Button>
        </div>
      </CardContent>
    </Card>
  );
}
