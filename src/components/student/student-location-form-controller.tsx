"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StudentLocationCascadeDialog } from "@/components/student/student-location-dialogs";
import {
  StudentLocationForm,
  type StudentLocationCityOption,
  type StudentLocationFormInitialValues,
  type StudentLocationFormValues,
} from "@/components/student/student-location-form";

type AffectedTreatment = {
  id: string;
  name: string;
};

type ApiResponse = {
  error?: string;
  requiresConfirmation?: boolean;
  affectedTreatments?: AffectedTreatment[];
  location?: {
    id: string;
  };
};

type StudentLocationFormControllerProps = {
  cities: StudentLocationCityOption[];
  isDisabled: boolean;
} & (
  | {
      mode: "create";
      studentLocationId?: never;
      initialValues?: never;
    }
  | {
      mode: "edit";
      studentLocationId: string;
      initialValues: StudentLocationFormInitialValues;
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

export function StudentLocationFormController(
  props: StudentLocationFormControllerProps,
) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [cascadeConflict, setCascadeConflict] = useState<{
    values: StudentLocationFormValues;
    affectedTreatments: AffectedTreatment[];
  } | null>(null);

  async function saveLocation(
    values: StudentLocationFormValues,
    confirmCascade = false,
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
          ? `/api/student-locations/${encodeURIComponent(
              props.studentLocationId,
            )}`
          : "/api/student-locations",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isEdit
              ? {
                  ...values,
                  confirmCascade,
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
        result.affectedTreatments
      ) {
        setErrorMessage(
          result.error ??
            "Operația necesită confirmarea dezactivării tratamentelor afectate.",
        );
        setCascadeConflict({
          values,
          affectedTreatments: result.affectedTreatments,
        });
        return;
      }

      if (!response.ok || !result.location) {
        setErrorMessage(
          result.error ??
            (isEdit
              ? "Locația nu a putut fi actualizată."
              : "Locația nu a putut fi adăugată."),
        );
        return;
      }

      router.replace("/cont/locatii");
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function confirmCascade() {
    if (!cascadeConflict) {
      return;
    }

    const values = cascadeConflict.values;

    setCascadeConflict(null);
    void saveLocation(values, true);
  }

  return (
    <>
      <StudentLocationForm
        cities={props.cities}
        initialValues={
          props.mode === "edit" ? props.initialValues : undefined
        }
        isPending={isPending}
        isDisabled={props.isDisabled}
        errorMessage={errorMessage}
        onCancel={() => router.push("/cont/locatii")}
        onSubmit={(values) => {
          void saveLocation(values);
        }}
      />

      <StudentLocationCascadeDialog
        affectedTreatments={
          cascadeConflict?.affectedTreatments ?? []
        }
        isPending={isPending}
        onCancel={() => setCascadeConflict(null)}
        onConfirm={confirmCascade}
      />
    </>
  );
}
