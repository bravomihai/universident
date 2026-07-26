"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StudentTreatmentDeactivateDialog } from "@/components/student/student-treatment-dialogs";
import {
  StudentTreatmentForm,
  type StudentTreatmentCatalogOption,
  type StudentTreatmentFormInitialValues,
  type StudentTreatmentFormValues,
} from "@/components/student/student-treatment-form";
import type { StudentTreatmentLocationOption } from "@/components/student/student-treatment-location-selector";

type ApiResponse = {
  error?: string;
  requiresConfirmation?: boolean;
  consequence?: string;
  treatment?: {
    id: string;
  };
};

type StudentTreatmentFormControllerProps = {
  catalogTreatments: StudentTreatmentCatalogOption[];
  locations: StudentTreatmentLocationOption[];
  isDisabled: boolean;
} & (
  | {
      mode: "create";
      studentTreatmentId?: never;
      initialValues?: never;
    }
  | {
      mode: "edit";
      studentTreatmentId: string;
      initialValues: StudentTreatmentFormInitialValues;
    }
);

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

export function StudentTreatmentFormController(
  props: StudentTreatmentFormControllerProps,
) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [deactivationConflict, setDeactivationConflict] =
    useState<StudentTreatmentFormValues | null>(null);

  async function saveTreatment(
    values: StudentTreatmentFormValues,
    confirmDeactivate = false,
  ) {
    if (isPending || props.isDisabled) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const isEdit = props.mode === "edit";
      const response = await fetch(
        isEdit
          ? `/api/student-treatments/${encodeURIComponent(
              props.studentTreatmentId,
            )}`
          : "/api/student-treatments",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isEdit
              ? {
                  description: values.description,
                  durationMinutes: values.durationMinutes,
                  locationIds: values.locationIds,
                  isActive: values.isActive,
                  confirmDeactivate,
                }
              : values,
          ),
        },
      );

      const result = await readApiResponse(response);

      if (
        isEdit &&
        response.status === 409 &&
        result.requiresConfirmation &&
        result.consequence === "DEACTIVATE_TREATMENT"
      ) {
        setDeactivationConflict(values);
        return;
      }

      if (!response.ok || !result.treatment) {
        setErrorMessage(
          result.error ??
            (isEdit
              ? "Tratamentul nu a putut fi actualizat."
              : "Tratamentul nu a putut fi adăugat."),
        );
        return;
      }

      router.replace("/cont/tratamente");
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function confirmAutomaticDeactivation() {
    if (!deactivationConflict) {
      return;
    }

    const values = deactivationConflict;

    setDeactivationConflict(null);
    void saveTreatment(values, true);
  }

  return (
    <>
      <StudentTreatmentForm
        catalogTreatments={props.catalogTreatments}
        locations={props.locations}
        initialValues={
          props.mode === "edit" ? props.initialValues : undefined
        }
        isPending={isPending}
        isDisabled={props.isDisabled}
        errorMessage={errorMessage}
        onCancel={() => router.push("/cont/tratamente")}
        onSubmit={(values) => {
          void saveTreatment(values);
        }}
      />

      <StudentTreatmentDeactivateDialog
        open={deactivationConflict !== null}
        isPending={isPending}
        onCancel={() => setDeactivationConflict(null)}
        onConfirm={confirmAutomaticDeactivation}
      />
    </>
  );
}
