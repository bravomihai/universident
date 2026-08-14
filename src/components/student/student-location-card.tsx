"use client";

import { Archive, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { StudentCardFeedbackMessage, type StudentCardFeedback } from "@/components/student/student-card-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StudentLocationCardData = { id: string; cityId: string; routeKey: string; name: string; cityName: string; address: string; details: string | null; createdAt: string; updatedAt: string };
export function StudentLocationCard({ location, isPending, isDisabled, feedback, onArchive }: { location: StudentLocationCardData; isPending: boolean; isDisabled: boolean; feedback: StudentCardFeedback | null; onArchive: (location: StudentLocationCardData) => void }) {
  return <Card aria-busy={isPending}><CardHeader><CardTitle>{location.name}</CardTitle><CardDescription className="flex items-center gap-2"><MapPin className="size-4" />{location.cityName}</CardDescription></CardHeader><CardContent className="space-y-4"><div><p>{location.address}</p>{location.details ? <p className="mt-1 text-sm text-muted-foreground">{location.details}</p> : null}</div><StudentCardFeedbackMessage feedback={feedback} /><div className="flex gap-2 border-t pt-4"><Button asChild variant="outline" size="sm"><Link href={`/cont/locatii/${location.routeKey}/editare`}><Pencil />Editare</Link></Button><Button type="button" variant="destructive" size="sm" disabled={isDisabled} onClick={() => onArchive(location)}><Archive />Arhivare</Button></div></CardContent></Card>;
}
