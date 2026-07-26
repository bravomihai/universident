"use client";

import { type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudentLocationCityOption = {
  id: string;
  name: string;
};

export type StudentLocationFormValues = {
  cityId: string;
  name: string;
  address: string;
  details: string;
  isActive: boolean;
};

export type StudentLocationFormInitialValues = {
  cityId: string;
  name: string;
  address: string;
  details: string | null;
  isActive: boolean;
};

type StudentLocationFormProps = {
  cities: StudentLocationCityOption[];
  initialValues?: StudentLocationFormInitialValues;
  isPending: boolean;
  isDisabled?: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (values: StudentLocationFormValues) => void;
};

export function StudentLocationForm({
  cities,
  initialValues,
  isPending,
  isDisabled = false,
  errorMessage,
  onCancel,
  onSubmit,
}: StudentLocationFormProps) {
  const formDisabled = isPending || isDisabled;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formDisabled) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    onSubmit({
      cityId: String(formData.get("cityId") ?? ""),
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      details: String(formData.get("details") ?? ""),
      isActive: formData.get("isActive") === "on",
    });
  }

  return (
    <Card id="location-form">
      <CardHeader>
        <CardTitle>
          {initialValues
            ? "Editează locația"
            : "Adaugă o locație"}
        </CardTitle>

        <CardDescription>
          Orașul este ales din catalogul Universident, iar adresa și
          detaliile descriu locul concret în care primești pacienți.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location-name">Numele locației</Label>
              <Input
                id="location-name"
                name="name"
                defaultValue={initialValues?.name}
                minLength={2}
                maxLength={120}
                disabled={formDisabled}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-city">Oraș</Label>
              <Select
                name="cityId"
                defaultValue={
                  initialValues?.cityId ?? cities[0]?.id ?? ""
                }
                disabled={formDisabled || cities.length === 0}
                required
              >
                <SelectTrigger id="location-city" className="w-full">
                  <SelectValue placeholder="Selectează orașul" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location-address">Adresă</Label>
            <Input
              id="location-address"
              name="address"
              defaultValue={initialValues?.address}
              minLength={5}
              maxLength={240}
              disabled={formDisabled}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location-details">Detalii</Label>
            <textarea
              id="location-details"
              name="details"
              defaultValue={initialValues?.details ?? ""}
              maxLength={1000}
              rows={4}
              disabled={formDisabled}
              className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Etaj, cabinet sau alte indicații utile"
            />
            <p className="text-xs text-muted-foreground">
              Opțional, maximum 1000 de caractere.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="location-active"
              name="isActive"
              type="checkbox"
              defaultChecked={initialValues?.isActive ?? true}
              disabled={formDisabled}
              className="mt-1 size-4"
            />

            <div className="space-y-1">
              <Label htmlFor="location-active">Locație activă</Label>
              <p className="text-sm text-muted-foreground">
                O locație inactivă rămâne în cont, dar nu este
                eligibilă pentru căutări sau programări.
              </p>
            </div>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={formDisabled || cities.length === 0}
            >
              {isPending
                ? "Se salvează..."
                : initialValues
                  ? "Salvează modificările"
                  : "Adaugă locația"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onCancel}
            >
              Anulează
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
