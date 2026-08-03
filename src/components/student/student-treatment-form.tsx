"use client";

import { type SubmitEvent, useState } from "react";

import {
  StudentTreatmentAssignmentEditor,
  type StudentTreatmentAssignmentDraft,
  type StudentTreatmentLocationOption,
} from "@/components/student/student-treatment-assignment-editor";
import type { StudentSupervisorOption } from "@/components/student/student-supervisor-form";
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

export type StudentTreatmentCatalogOption = {
  id: string;
  name: string;
  description: string;
};

export type StudentTreatmentFormValues = {
  treatmentId: string;
  description: string;
  durationMinutes: number;
  locationAssignments: {
    studentLocationId: string;
    supervisorId: string;
  }[];
  isActive: boolean;
};

export type StudentTreatmentFormInitialValues = {
  treatmentId: string;
  name: string;
  catalogDescription: string;
  description: string | null;
  durationMinutes: number;
  locationAssignments: StudentTreatmentAssignmentDraft[];
  isActive: boolean;
};

type StudentTreatmentFormProps = {
  catalogTreatments: StudentTreatmentCatalogOption[];
  locations: StudentTreatmentLocationOption[];
  supervisors: StudentSupervisorOption[];
  initialValues?: StudentTreatmentFormInitialValues;
  isPending: boolean;
  isDisabled?: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (values: StudentTreatmentFormValues) => void;
};

export function StudentTreatmentForm({
  catalogTreatments,
  locations,
  supervisors,
  initialValues,
  isPending,
  isDisabled = false,
  errorMessage,
  onCancel,
  onSubmit,
}: StudentTreatmentFormProps) {
  const [selectedTreatmentId, setSelectedTreatmentId] = useState(
    initialValues?.treatmentId ??
      catalogTreatments[0]?.id ??
      "",
  );
  const [locationAssignments, setLocationAssignments] = useState<
    StudentTreatmentAssignmentDraft[]
  >(
    initialValues?.locationAssignments ?? [],
  );
  const [isActive, setIsActive] = useState(
    initialValues?.isActive ?? false,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const formDisabled = isPending || isDisabled;

  const selectedCatalogTreatment = catalogTreatments.find(
    (treatment) => treatment.id === selectedTreatmentId,
  );

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);

    if (formDisabled) {
      return;
    }

    if (!initialValues && !selectedTreatmentId) {
      setClientError("Selectează un tratament din catalog.");
      return;
    }

    const locationIds = locationAssignments.map(
      (assignment) => assignment.studentLocationId,
    );

    if (new Set(locationIds).size !== locationIds.length) {
      setClientError("O locație poate apărea o singură dată în tratament.");
      return;
    }

    const hasInvalidAssignment = locationAssignments.some((assignment) => {
      const location = locations.find(
        (option) => option.id === assignment.studentLocationId,
      );
      return (
        !location?.isActive ||
        !assignment.supervisorId
      );
    });

    if (hasInvalidAssignment) {
      setClientError(
        "Fiecare asociere trebuie să aibă o locație activă și un profesor disponibil.",
      );
      return;
    }

    if (
      isActive &&
      locationAssignments.length === 0 &&
      !initialValues?.isActive
    ) {
      setClientError(
        "Pentru activare, adaugă cel puțin o locație cu profesor atribuit.",
      );
      return;
    }

    const formData = new FormData(event.currentTarget);

    onSubmit({
      treatmentId:
        initialValues?.treatmentId ?? selectedTreatmentId,
      description: String(formData.get("description") ?? ""),
      durationMinutes: Number(formData.get("durationMinutes")),
      locationAssignments: locationAssignments.map((assignment) => ({
        studentLocationId: assignment.studentLocationId,
        supervisorId: assignment.supervisorId as string,
      })),
      isActive,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialValues
            ? `Editează ${initialValues.name}`
            : "Adaugă un tratament"}
        </CardTitle>

        <CardDescription>
          Tratamentul este ales din catalog, iar durata și
          descrierea sunt specifice profilului tău.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {initialValues ? (
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tratament
              </p>
              <p className="mt-1 font-medium">
                {initialValues.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {initialValues.catalogDescription}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="student-treatment-catalog">
                Tratament
              </Label>
              <Select
                value={selectedTreatmentId}
                disabled={formDisabled}
                onValueChange={setSelectedTreatmentId}
              >
                <SelectTrigger
                  id="student-treatment-catalog"
                  className="w-full"
                >
                  <SelectValue placeholder="Selectează tratamentul" />
                </SelectTrigger>
                <SelectContent>
                  {catalogTreatments.map((treatment) => (
                    <SelectItem
                      key={treatment.id}
                      value={treatment.id}
                    >
                      {treatment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCatalogTreatment ? (
                <p className="text-sm text-muted-foreground">
                  {selectedCatalogTreatment.description}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="student-treatment-description">
              Descriere
            </Label>
            <textarea
              id="student-treatment-description"
              name="description"
              defaultValue={initialValues?.description ?? ""}
              maxLength={1000}
              rows={5}
              disabled={formDisabled}
              className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Detalii despre modul în care oferi tratamentul"
            />
            <p className="text-xs text-muted-foreground">
              Opțional, maximum 1000 de caractere.
            </p>
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="student-treatment-duration">
              Durată în minute
            </Label>
            <Input
              id="student-treatment-duration"
              name="durationMinutes"
              type="number"
              min={5}
              max={480}
              step={1}
              defaultValue={initialValues?.durationMinutes ?? 60}
              disabled={formDisabled}
              required
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Locații și supervizare
            </legend>

            <p className="text-sm text-muted-foreground">
              Fiecare locație în care oferi tratamentul trebuie să aibă
              un profesor supervizor activ din lista ta.
            </p>

            <StudentTreatmentAssignmentEditor
              locations={locations}
              supervisors={supervisors}
              assignments={locationAssignments}
              disabled={formDisabled}
              onChange={(assignments) => {
                setLocationAssignments(assignments);
                setClientError(null);
              }}
            />
          </fieldset>

          <div className="flex items-start gap-3">
            <input
              id="student-treatment-active"
              type="checkbox"
              checked={isActive}
              disabled={formDisabled}
              className="mt-1 size-4"
              onChange={(event) => {
                setIsActive(event.target.checked);
                setClientError(null);
              }}
            />

            <div className="space-y-1">
              <Label htmlFor="student-treatment-active">
                Tratament activ
              </Label>
              <p className="text-sm text-muted-foreground">
                Un tratament activ trebuie să aibă minimum o locație
                activă cu profesor disponibil atribuit.
              </p>
            </div>
          </div>

          {clientError || errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {clientError ?? errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={formDisabled}>
              {isPending
                ? "Se salvează..."
                : initialValues
                  ? "Salvează modificările"
                  : "Adaugă tratamentul"}
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
