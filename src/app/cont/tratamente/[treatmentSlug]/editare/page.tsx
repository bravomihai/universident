import type { Metadata } from "next";
import Link from "next/link";
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
  return <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16"><div className="w-full max-w-3xl space-y-6">
    <Link href="/cont/tratamente" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Înapoi la tratamente</Link>
    <div><h1 className="text-3xl font-semibold tracking-tight">Editează tratamentul</h1><p className="mt-2 text-muted-foreground">Modifică durata folosită la împărțirea inteligentă a intervalelor.</p></div>
    <StudentTreatmentFormController mode="edit" studentTreatmentId={treatment.id} catalogTreatments={[]} isDisabled={false} initialValues={{ treatmentId: treatment.treatmentId, name: treatment.treatment.name, catalogDescription: treatment.treatment.description, description: treatment.description, durationMinutes: treatment.durationMinutes }} />
  </div></main>;
}
