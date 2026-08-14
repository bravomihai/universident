import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";

import { StudentTreatmentFormController } from "@/components/student/student-treatment-form-controller";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = { title: "Adaugă tratament" };

export default async function NewStudentTreatmentPage() {
  const session = await requireStudentPageSession();
  const [profile, catalog] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, studentTreatments: { select: { treatmentId: true } } },
    }),
    prisma.treatment.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
  ]);
  const used = new Set(profile?.studentTreatments.map((item) => item.treatmentId) ?? []);
  const available = catalog.filter((item) => !used.has(item.id));
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-3xl space-y-6">
    <BackLink href="/cont/tratamente">Înapoi la tratamente</BackLink>
    <div><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><Stethoscope className="size-5" aria-hidden="true" /></span><h1 className="text-3xl font-semibold tracking-tight">Tratament nou</h1></div><p className="mt-2 text-muted-foreground">Tratamentul va putea fi bifat ulterior în dialogul calendarului.</p></div>
    {!profile ? <p className="rounded-xl border p-4 text-sm">Completează mai întâi profilul profesional.</p> : null}
    {profile && available.length === 0 ? <p className="rounded-xl border p-4 text-sm">Toate tratamentele din catalog au fost deja adăugate sau arhivate.</p> : null}
    <StudentTreatmentFormController mode="create" catalogTreatments={available} isDisabled={!profile || available.length === 0} />
  </div></main>;
}
