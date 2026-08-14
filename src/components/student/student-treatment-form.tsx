"use client";

import { type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type StudentTreatmentCatalogOption = { id: string; name: string; description: string };
export type StudentTreatmentFormValues = { treatmentId: string; description: string; durationMinutes: number };
export type StudentTreatmentFormInitialValues = {
  treatmentId: string;
  name: string;
  catalogDescription: string;
  description: string | null;
  durationMinutes: number;
};

export function StudentTreatmentForm({
  catalogTreatments,
  initialValues,
  isPending,
  isDisabled = false,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  catalogTreatments: StudentTreatmentCatalogOption[];
  initialValues?: StudentTreatmentFormInitialValues;
  isPending: boolean;
  isDisabled?: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (values: StudentTreatmentFormValues) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      treatmentId: initialValues?.treatmentId ?? String(form.get("treatmentId") ?? ""),
      description: String(form.get("description") ?? ""),
      durationMinutes: Number(form.get("durationMinutes")),
    });
  }
  const disabled = isPending || isDisabled;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialValues ? `Editează ${initialValues.name}` : "Adaugă un tratament"}</CardTitle>
        <CardDescription>Durata și descrierea sunt folosite când tratamentul este bifat într-un interval din calendar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          {initialValues ? (
            <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium">{initialValues.name}</p><p className="mt-1 text-sm text-muted-foreground">{initialValues.catalogDescription}</p></div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="treatmentId">Tratament</Label>
              <Select name="treatmentId" disabled={disabled} required>
                <SelectTrigger id="treatmentId" className="w-full"><SelectValue placeholder="Selectează tratamentul" /></SelectTrigger>
                <SelectContent>{catalogTreatments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label htmlFor="durationMinutes">Durată (minute)</Label><Input id="durationMinutes" name="durationMinutes" type="number" min={15} max={480} step={15} required defaultValue={initialValues?.durationMinutes ?? 60} disabled={disabled} /></div>
          <div className="space-y-2"><Label htmlFor="description">Descriere (opțional)</Label><textarea id="description" name="description" maxLength={1000} rows={5} defaultValue={initialValues?.description ?? ""} disabled={disabled} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" /></div>
          {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex gap-2"><Button type="submit" disabled={disabled}>{isPending ? "Se salvează…" : "Salvează"}</Button><Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>Anulează</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
