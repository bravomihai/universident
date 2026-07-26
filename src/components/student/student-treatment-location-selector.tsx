"use client";

export type StudentTreatmentLocationOption = {
  id: string;
  name: string;
  address: string;
  cityName: string;
  isActive: boolean;
};

type StudentTreatmentLocationSelectorProps = {
  locations: StudentTreatmentLocationOption[];
  selectedLocationIds: string[];
  disabled: boolean;
  onChange: (locationIds: string[]) => void;
};

export function StudentTreatmentLocationSelector({
  locations,
  selectedLocationIds,
  disabled,
  onChange,
}: StudentTreatmentLocationSelectorProps) {
  function toggleLocation(locationId: string, checked: boolean) {
    if (checked) {
      onChange([...selectedLocationIds, locationId]);
      return;
    }

    onChange(
      selectedLocationIds.filter(
        (selectedLocationId) =>
          selectedLocationId !== locationId,
      ),
    );
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-5">
        <p className="text-sm font-medium">
          Nu ai nicio locație disponibilă
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Poți salva tratamentul fără locații, dar acesta va rămâne
          inactiv până când îi asociezi minimum o locație activă.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {locations.map((location) => {
        const inputId = `treatment-location-${location.id}`;

        return (
          <label
            key={location.id}
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/20 p-4 transition hover:bg-muted/40 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
          >
            <input
              id={inputId}
              type="checkbox"
              checked={selectedLocationIds.includes(location.id)}
              disabled={disabled}
              className="mt-1 size-4"
              onChange={(event) =>
                toggleLocation(location.id, event.target.checked)
              }
            />

            <span className="min-w-0">
              <span className="block font-medium">
                {location.name}
              </span>
              <span className="block text-sm text-muted-foreground">
                {location.cityName} ·{" "}
                {location.isActive ? "Activă" : "Inactivă"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {location.address}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
