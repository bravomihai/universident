import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PublicCatalogOption } from "@/lib/public-students/public-student-service";

type PublicStudentSearchFormProps = {
  treatments: PublicCatalogOption[];
  cities: PublicCatalogOption[];
  selectedTreatmentSlug: string;
  selectedCitySlug: string;
};

const selectClassName =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PublicStudentSearchForm({
  treatments,
  cities,
  selectedTreatmentSlug,
  selectedCitySlug,
}: PublicStudentSearchFormProps) {
  const hasSelection = selectedTreatmentSlug || selectedCitySlug;

  return (
    <form
      action="/studenti"
      method="get"
      className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
    >
      <div className="space-y-2">
        <Label htmlFor="student-search-treatment">Tratament</Label>
        <select
          id="student-search-treatment"
          name="tratament"
          required
          defaultValue={selectedTreatmentSlug}
          className={selectClassName}
        >
          <option value="" disabled>
            Alege tratamentul
          </option>
          {treatments.map((treatment) => (
            <option key={treatment.slug} value={treatment.slug}>
              {treatment.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-search-city">Oraș</Label>
        <select
          id="student-search-city"
          name="oras"
          required
          defaultValue={selectedCitySlug}
          className={selectClassName}
        >
          <option value="" disabled>
            Alege orașul
          </option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-w-28">
          <Search aria-hidden="true" />
          Caută
        </Button>
        {hasSelection ? (
          <Button asChild type="button" variant="ghost">
            <Link href="/studenti">Resetează</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
