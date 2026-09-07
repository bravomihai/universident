import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";

import { StudentTreatmentFormController } from "@/components/student/student-treatment-form-controller";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = { title: "Editează tratamentul" };

export default async function EditStudentTreatmentPage({ params }: { params: Promise<{ treatmentSlug: string }> }) {
  const session = await requireStudentPageSession();
  const { treatmentSlug } = await params;
  const treatment = await prisma.studentTreatment.findFirst({
    where: { studentProfile: { userId: session.user.id }, deletedAt: null, treatment: { slug: treatmentSlug } },
    include: { treatment: true },
  });
  if (!treatment) notFound();
  return <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-3xl space-y-6">
    <BackLink href="/cont/tratamente">Înapoi la tratamente</BackLink>
    <div><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-full border bg-card"><Stethoscope className="size-5" aria-hidden="true" /></span><h1 className="text-3xl font-semibold tracking-tight">Editează tratamentul</h1></div><p className="mt-2 text-muted-foreground">Modifică durata folosită la împărțirea inteligentă a intervalelor.</p></div>
    <StudentTreatmentFormController mode="edit" studentTreatmentId={treatment.id} catalogTreatments={[]} isDisabled={false} initialValues={{ treatmentId: treatment.treatmentId, name: treatment.treatment.name, catalogDescription: treatment.treatment.description, description: treatment.description, durationMinutes: treatment.durationMinutes }} />
  </div></main>;
}
