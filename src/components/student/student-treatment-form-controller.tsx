"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  StudentTreatmentForm,
  type StudentTreatmentCatalogOption,
  type StudentTreatmentFormInitialValues,
  type StudentTreatmentFormValues,
} from "@/components/student/student-treatment-form";

type Props = {
  catalogTreatments: StudentTreatmentCatalogOption[];
  isDisabled: boolean;
} & (
  | { mode: "create"; studentTreatmentId?: never; initialValues?: never }
  | { mode: "edit"; studentTreatmentId: string; initialValues: StudentTreatmentFormInitialValues }
);

export function StudentTreatmentFormController(props: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(values: StudentTreatmentFormValues) {
    setPending(true); setError(null);
    try {
      const editing = props.mode === "edit";
      const response = await fetch(editing ? `/api/student-treatments/${encodeURIComponent(props.studentTreatmentId)}` : "/api/student-treatments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { description: values.description, durationMinutes: values.durationMinutes } : values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tratamentul nu a putut fi salvat.");
      router.replace("/cont/tratamente"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tratamentul nu a putut fi salvat."); }
    finally { setPending(false); }
  }
  return <StudentTreatmentForm catalogTreatments={props.catalogTreatments} initialValues={props.mode === "edit" ? props.initialValues : undefined} isPending={pending} isDisabled={props.isDisabled} errorMessage={error} onCancel={() => router.push("/cont/tratamente")} onSubmit={(values) => void save(values)} />;
}
