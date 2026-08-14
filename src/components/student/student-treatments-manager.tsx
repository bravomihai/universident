"use client";

import { Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StudentTreatmentCard, type StudentTreatmentCardData } from "@/components/student/student-treatment-card";
import { StudentTreatmentArchiveDialog } from "@/components/student/student-treatment-dialogs";
import { StudentProfessionalNavigation } from "@/components/student/student-professional-navigation";
import { useCardFeedback } from "@/components/student/use-card-feedback";
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
    <Link href="/cont" className="inline-flex text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la cont</Link>
    <StudentProfessionalNavigation current="treatments" />
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">Profil profesional</p><h1 className="text-3xl font-semibold tracking-tight">Tratamente</h1><p className="text-muted-foreground">Configurează tratamentele și durata folosită de algoritmul calendarului.</p></div><Button asChild><Link href="/cont/tratamente/nou"><Plus />Adaugă tratament</Link></Button></div>
    {!hasStudentProfile ? <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Completează mai întâi profilul profesional.</p> : null}
    {treatments.length ? <div className="grid gap-4 lg:grid-cols-2">{treatments.map((treatment) => <StudentTreatmentCard key={treatment.id} treatment={treatment} isPending={pendingId === treatment.id} isDisabled={pendingId !== null} feedback={feedbackById[treatment.id] ?? null} onArchive={setCandidate} />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center"><Stethoscope className="mb-3 size-6" /><h2 className="font-semibold">Nu ai adăugat niciun tratament</h2><p className="mt-2 text-sm text-muted-foreground">Adaugă tratamentele pe care le vei putea bifa în calendar.</p></CardContent></Card>}
    <StudentTreatmentArchiveDialog treatmentName={candidate?.name ?? null} isPending={false} onCancel={() => setCandidate(null)} onConfirm={() => candidate && void archive(candidate)} />
  </>;
}
