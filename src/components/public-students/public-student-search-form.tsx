"use client";

import Link from "@/components/navigation/app-link";
import { Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PublicCatalogOption } from "@/lib/public-students/public-student-service";

type PublicStudentSearchFormProps = {
  treatments: PublicCatalogOption[];
  cities: PublicCatalogOption[];
  selectedTreatmentSlug?: string;
  selectedCitySlug?: string;
  className?: string;
  trailingAction?: ReactNode;
};

export function PublicStudentSearchForm({
  treatments,
  cities,
  selectedTreatmentSlug = "",
  selectedCitySlug = "",
  className,
  trailingAction,
}: PublicStudentSearchFormProps) {
  const hasSelection = selectedTreatmentSlug || selectedCitySlug;
  const [invalidFilter, setInvalidFilter] = useState("");

  function handleInvalid(event: FormEvent<HTMLFormElement>) {
    const field = event.target;
    if (!(field instanceof HTMLSelectElement)) return;
    event.preventDefault();

    if (field !== event.currentTarget.querySelector("select:invalid")) return;
    setInvalidFilter(field.name);
    field.parentElement?.querySelector<HTMLButtonElement>('[data-slot="select-trigger"]')?.focus();
  }

  return (
    <form
      action="/studenti"
      method="get"
      aria-label="Caută studenți"
      onInvalid={handleInvalid}
      className={cn("public-search-form grid gap-4 rounded-2xl border bg-card p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center", className)}
    >
      <div>
        <Label className="sr-only" htmlFor="student-search-treatment">Tratament</Label>
        <Select
          name="tratament"
          required
          defaultValue={selectedTreatmentSlug}
          onValueChange={() => {
            if (invalidFilter === "tratament") setInvalidFilter("");
          }}
        >
          <SelectTrigger
            id="student-search-treatment"
            aria-invalid={invalidFilter === "tratament" || undefined}
            className="w-full"
          >
            <SelectValue placeholder="Alege tratamentul" />
          </SelectTrigger>
          <SelectContent>
            {treatments.map((treatment) => (
              <SelectItem key={treatment.slug} value={treatment.slug}>
                {treatment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="sr-only" htmlFor="student-search-city">Oraș</Label>
        <Select
          name="oras"
          required
          defaultValue={selectedCitySlug}
          onValueChange={() => {
            if (invalidFilter === "oras") setInvalidFilter("");
          }}
        >
          <SelectTrigger
            id="student-search-city"
            aria-invalid={invalidFilter === "oras" || undefined}
            className="w-full"
          >
            <SelectValue placeholder="Alege orașul" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.slug} value={city.slug}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("flex flex-wrap gap-2", trailingAction && "heading-actions justify-between md:justify-start")}>
        <Button
          type="submit"
          className={cn("min-w-28", trailingAction && "max-[381px]:min-w-0")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Search aria-hidden="true" className="max-[381px]:hidden" />
            <span>Caută</span>
          </span>
        </Button>
        {hasSelection ? (
          <Button asChild variant="outline">
            <Link href="/studenti">Resetează</Link>
          </Button>
        ) : null}
        {trailingAction}
      </div>
      {invalidFilter ? (
        <p role="alert" className="text-sm text-destructive md:col-span-full">
          {invalidFilter === "tratament" ? "Alege tratamentul." : "Alege orașul."}
        </p>
      ) : null}
    </form>
  );
}
