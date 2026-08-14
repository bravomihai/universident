"use client";

import { MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudentLocationCard, type StudentLocationCardData } from "@/components/student/student-location-card";
import { StudentLocationArchiveDialog } from "@/components/student/student-location-dialogs";
import { StudentProfessionalNavigation } from "@/components/student/student-professional-navigation";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function StudentLocationsManager({ initialLocations }: { initialLocations: StudentLocationCardData[]; hasStudentProfile: boolean }) {
  const router = useRouter(); const [locations, setLocations] = useState(initialLocations); const [pendingId, setPendingId] = useState<string | null>(null); const [candidate, setCandidate] = useState<StudentLocationCardData | null>(null); const { feedbackById, showFeedback } = useCardFeedback();
  async function archive(location: StudentLocationCardData) { setCandidate(null); setPendingId(location.id); try { const response = await fetch(`/api/student-locations/${encodeURIComponent(location.id)}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Locația nu a putut fi arhivată."); setLocations((items) => items.filter((item) => item.id !== location.id)); router.refresh(); } catch (caught) { showFeedback(location.id, { type: "error", message: caught instanceof Error ? caught.message : "Locația nu a putut fi arhivată." }); } finally { setPendingId(null); } }
  return <><BackLink href="/cont">Înapoi la cont</BackLink><StudentProfessionalNavigation current="locations" /><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><MapPin className="size-5" aria-hidden="true" /></span><h1 className="text-3xl font-semibold tracking-tight">Locații</h1></div><p className="max-w-3xl text-muted-foreground">Administrează locațiile pe care le poți selecta pentru intervalele din calendar.</p></div><Button asChild><Link href="/cont/locatii/nou"><Plus />Adaugă locație</Link></Button></div>{locations.length ? <div className="grid gap-4 lg:grid-cols-2">{locations.map((location) => <StudentLocationCard key={location.id} location={location} isPending={pendingId === location.id} isDisabled={pendingId !== null} feedback={feedbackById[location.id] ?? null} onArchive={setCandidate} />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center"><MapPin className="mb-3" /><h2 className="font-semibold">Nu ai adăugat nicio locație</h2></CardContent></Card>}<StudentLocationArchiveDialog locationName={candidate?.name ?? null} isPending={false} onCancel={() => setCandidate(null)} onConfirm={() => candidate && void archive(candidate)} /></>;
}
