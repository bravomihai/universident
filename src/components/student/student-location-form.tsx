"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type StudentLocationCityOption = { id: string; name: string };
export type StudentLocationFormValues = { cityId: string; name: string; address: string; details: string };
export type StudentLocationFormInitialValues = { cityId: string; name: string; address: string; details: string | null };

export function StudentLocationForm({ cities, initialValues, isPending, isDisabled = false, errorMessage, onCancel, onSubmit }: {
  cities: StudentLocationCityOption[]; initialValues?: StudentLocationFormInitialValues; isPending: boolean; isDisabled?: boolean; errorMessage: string | null; onCancel: () => void; onSubmit: (values: StudentLocationFormValues) => void;
}) {
  const disabled = isPending || isDisabled;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ cityId: String(data.get("cityId") ?? ""), name: String(data.get("name") ?? ""), address: String(data.get("address") ?? ""), details: String(data.get("details") ?? "") }); }
  return <Card><CardHeader><CardTitle>{initialValues ? "Editează locația" : "Adaugă o locație"}</CardTitle><CardDescription>Locația va putea fi aleasă pentru fiecare interval din calendar.</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={submit}>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="location-name">Numele locației</Label><Input id="location-name" name="name" minLength={2} maxLength={160} defaultValue={initialValues?.name} disabled={disabled} required /></div><div className="space-y-2"><Label htmlFor="location-city">Oraș</Label><Select name="cityId" defaultValue={initialValues?.cityId ?? cities[0]?.id} disabled={disabled || !cities.length} required><SelectTrigger id="location-city" className="w-full"><SelectValue placeholder="Selectează orașul" /></SelectTrigger><SelectContent>{cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-2"><Label htmlFor="location-address">Adresă</Label><Input id="location-address" name="address" minLength={5} maxLength={240} defaultValue={initialValues?.address} disabled={disabled} required /></div>
    <div className="space-y-2"><Label htmlFor="location-details">Detalii (opțional)</Label><textarea id="location-details" name="details" maxLength={1000} rows={4} defaultValue={initialValues?.details ?? ""} disabled={disabled} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" /></div>
    {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}<div className="flex gap-2"><Button type="submit" disabled={disabled || !cities.length}>{isPending ? "Se salvează…" : "Salvează"}</Button><Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>Anulează</Button></div>
  </form></CardContent></Card>;
}
