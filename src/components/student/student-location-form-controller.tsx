"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudentLocationForm, type StudentLocationCityOption, type StudentLocationFormInitialValues, type StudentLocationFormValues } from "@/components/student/student-location-form";

type Props = { cities: StudentLocationCityOption[]; isDisabled: boolean } & ({ mode: "create"; studentLocationId?: never; initialValues?: never } | { mode: "edit"; studentLocationId: string; initialValues: StudentLocationFormInitialValues });
export function StudentLocationFormController(props: Props) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save(values: StudentLocationFormValues) { setPending(true); setError(null); try { const edit = props.mode === "edit"; const response = await fetch(edit ? `/api/student-locations/${encodeURIComponent(props.studentLocationId)}` : "/api/student-locations", { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Locația nu a putut fi salvată."); router.replace("/cont/locatii"); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Locația nu a putut fi salvată."); } finally { setPending(false); } }
  return <StudentLocationForm cities={props.cities} initialValues={props.mode === "edit" ? props.initialValues : undefined} isPending={pending} isDisabled={props.isDisabled} errorMessage={error} onCancel={() => router.push("/cont/locatii")} onSubmit={(values) => void save(values)} />;
}
