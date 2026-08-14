"use client";

import { Archive, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { StudentCardFeedbackMessage, type StudentCardFeedback } from "@/components/student/student-card-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StudentLocationCardData = { id: string; cityId: string; routeKey: string; name: string; cityName: string; address: string; details: string | null; createdAt: string; updatedAt: string };
export function StudentLocationCard({ location, isPending, isDisabled, feedback, onArchive }: { location: StudentLocationCardData; isPending: boolean; isDisabled: boolean; feedback: StudentCardFeedback | null; onArchive: (location: StudentLocationCardData) => void }) {
  return (
    <Card aria-busy={isPending}>
      <CardHeader className="gap-2 p-5 pb-3">
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
      <CardContent className="space-y-3 px-5 pt-0 pb-5">
        {location.details ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {location.details}
          </p>
        ) : null}
        <StudentCardFeedbackMessage feedback={feedback} />
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/cont/locatii/${location.routeKey}/editare`}><Pencil />Editare</Link>
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={isDisabled} onClick={() => onArchive(location)}><Archive />Arhivare</Button>
        </div>
      </CardContent>
    </Card>
  );
}
