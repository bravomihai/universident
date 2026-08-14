"use client";

import { Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StudentTreatmentCard, type StudentTreatmentCardData } from "@/components/student/student-treatment-card";
import { StudentTreatmentArchiveDialog } from "@/components/student/student-treatment-dialogs";
import { StudentProfessionalNavigation } from "@/components/student/student-professional-navigation";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function StudentTreatmentsManager({ initialTreatments, hasStudentProfile }: { initialTreatments: StudentTreatmentCardData[]; hasStudentProfile: boolean }) {
  const router = useRouter();
  const [treatments, setTreatments] = useState(initialTreatments);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<StudentTreatmentCardData | null>(null);
  const { feedbackById, showFeedback, clearFeedback } = useCardFeedback();
  async function archive(treatment: StudentTreatmentCardData) {
    setCandidate(null); setPendingId(treatment.id); clearFeedback(treatment.id);
    try {
      const response = await fetch(`/api/student-treatments/${encodeURIComponent(treatment.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tratamentul nu a putut fi arhivat.");
      setTreatments((items) => items.filter((item) => item.id !== treatment.id)); router.refresh();
    } catch (caught) { showFeedback(treatment.id, { type: "error", message: caught instanceof Error ? caught.message : "Tratamentul nu a putut fi arhivat." }); }
    finally { setPendingId(null); }
  }
  return <>
    <BackLink href="/cont">Înapoi la cont</BackLink>
    <StudentProfessionalNavigation current="treatments" />
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><Stethoscope className="size-5" aria-hidden="true" /></span><h1 className="text-3xl font-semibold tracking-tight">Tratamente</h1></div><p className="max-w-3xl text-muted-foreground">Configurează tratamentele și durata folosită de algoritmul calendarului. Locația și supervizorul se aleg direct pentru fiecare interval din calendar.</p></div><Button asChild><Link href="/cont/tratamente/nou"><Plus />Adaugă tratament</Link></Button></div>
    {!hasStudentProfile ? <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Completează mai întâi profilul profesional.</p> : null}
    {treatments.length ? <div className="grid gap-4 lg:grid-cols-2">{treatments.map((treatment) => <StudentTreatmentCard key={treatment.id} treatment={treatment} isPending={pendingId === treatment.id} isDisabled={pendingId !== null} feedback={feedbackById[treatment.id] ?? null} onArchive={setCandidate} />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center"><Stethoscope className="mb-3 size-6" /><h2 className="font-semibold">Nu ai adăugat niciun tratament</h2><p className="mt-2 text-sm text-muted-foreground">Adaugă tratamentele pe care le vei putea bifa în calendar.</p></CardContent></Card>}
    <StudentTreatmentArchiveDialog treatmentName={candidate?.name ?? null} isPending={false} onCancel={() => setCandidate(null)} onConfirm={() => candidate && void archive(candidate)} />
  </>;
}
