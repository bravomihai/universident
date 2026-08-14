"use client";

import { Archive, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { StudentCardFeedbackMessage, type StudentCardFeedback } from "@/components/student/student-card-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StudentLocationCardData = { id: string; cityId: string; routeKey: string; name: string; cityName: string; address: string; details: string | null; createdAt: string; updatedAt: string };
export function StudentLocationCard({ location, isPending, isDisabled, feedback, onArchive }: { location: StudentLocationCardData; isPending: boolean; isDisabled: boolean; feedback: StudentCardFeedback | null; onArchive: (location: StudentLocationCardData) => void }) {
  return (
    <Card size="sm" className="h-fit self-start" aria-busy={isPending}>
      <CardHeader className="gap-1.5">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg leading-snug">{location.name}</CardTitle>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="size-4 stroke-[2.5]" aria-hidden="true" />
            {location.cityName}
          </span>
        </div>
        <CardDescription className="text-base font-medium leading-relaxed text-foreground">
          {location.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {location.details ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {location.details}
          </p>
        ) : null}
        <StudentCardFeedbackMessage feedback={feedback} />
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <Button asChild variant="outline" className="w-full">
            <Link href={`/cont/locatii/${location.routeKey}/editare`}><Pencil />Editare</Link>
          </Button>
          <Button type="button" variant="destructive" className="w-full" disabled={isDisabled} onClick={() => onArchive(location)}><Archive />Arhivare</Button>
        </div>
      </CardContent>
    </Card>
  );
}
