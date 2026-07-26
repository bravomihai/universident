"use client";

import { Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { StudentCardFeedback } from "@/components/student/student-card-feedback";
import {
  StudentTreatmentCard,
  type StudentTreatmentCardData,
} from "@/components/student/student-treatment-card";
import { StudentTreatmentArchiveDialog } from "@/components/student/student-treatment-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StudentTreatmentsManagerProps = {
  initialTreatments: StudentTreatmentCardData[];
  hasStudentProfile: boolean;
};

type PendingOperation = {
  kind: "update" | "archive";
  treatmentId: string;
};

type ApiTreatment = {
  id: string;
  treatmentId: string;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  treatment: {
    name: string;
    slug: string;
    description: string;
  };
  treatmentLocations: {
    isActive: boolean;
    studentLocation: {
      id: string;
      name: string;
      address: string;
      isActive: boolean;
      city: {
        name: string;
      };
    };
  }[];
};

type ApiResponse = {
  error?: string;
  treatment?: ApiTreatment;
};

function toTreatmentCardData(
  treatment: ApiTreatment,
): StudentTreatmentCardData {
  return {
    id: treatment.id,
    treatmentId: treatment.treatmentId,
    treatmentSlug: treatment.treatment.slug,
    name: treatment.treatment.name,
    catalogDescription: treatment.treatment.description,
    description: treatment.description,
    durationMinutes: treatment.durationMinutes,
    isActive: treatment.isActive,
    locations: treatment.treatmentLocations
      .filter((association) => association.isActive)
      .map((association) => ({
        id: association.studentLocation.id,
        name: association.studentLocation.name,
        address: association.studentLocation.address,
        cityName: association.studentLocation.city.name,
        isActive: association.studentLocation.isActive,
      })),
    createdAt: treatment.createdAt,
    updatedAt: treatment.updatedAt,
  };
}

function sortTreatments(
  treatments: StudentTreatmentCardData[],
): StudentTreatmentCardData[] {
  return [...treatments].sort((first, second) => {
    if (first.isActive !== second.isActive) {
      return first.isActive ? -1 : 1;
    }

    return first.name.localeCompare(second.name, "ro");
  });
}

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

export function StudentTreatmentsManager({
  initialTreatments,
  hasStudentProfile,
}: StudentTreatmentsManagerProps) {
  const router = useRouter();
  const [treatments, setTreatments] =
    useState<StudentTreatmentCardData[]>(initialTreatments);
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation | null>(null);
  const [cardFeedback, setCardFeedback] = useState<
    Record<string, StudentCardFeedback>
  >({});
  const [archiveCandidate, setArchiveCandidate] =
    useState<StudentTreatmentCardData | null>(null);

  function clearFeedback(treatmentId: string) {
    setCardFeedback((currentFeedback) => {
      if (!(treatmentId in currentFeedback)) {
        return currentFeedback;
      }

      const nextFeedback = {
        ...currentFeedback,
      };
      delete nextFeedback[treatmentId];
      return nextFeedback;
    });
  }

  function showFeedback(
    treatmentId: string,
    feedback: StudentCardFeedback,
  ) {
    setCardFeedback((currentFeedback) => ({
      ...currentFeedback,
      [treatmentId]: feedback,
    }));
  }

  function replaceTreatment(updatedTreatment: StudentTreatmentCardData) {
    setTreatments((currentTreatments) =>
      sortTreatments(
        currentTreatments.map((treatment) =>
          treatment.id === updatedTreatment.id
            ? updatedTreatment
            : treatment,
        ),
      ),
    );
  }

  async function toggleTreatment(
    treatment: StudentTreatmentCardData,
  ) {
    if (pendingOperation) {
      return;
    }

    const nextIsActive = !treatment.isActive;

    setPendingOperation({
      kind: "update",
      treatmentId: treatment.id,
    });
    clearFeedback(treatment.id);

    try {
      const response = await fetch(
        `/api/student-treatments/${encodeURIComponent(treatment.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: nextIsActive,
          }),
        },
      );
      const result = await readApiResponse(response);

      if (!response.ok || !result.treatment) {
        showFeedback(treatment.id, {
          type: "error",
          message:
            result.error ??
            (nextIsActive
              ? "Tratamentul nu a putut fi activat."
              : "Tratamentul nu a putut fi dezactivat."),
        });
        return;
      }

      replaceTreatment(toTreatmentCardData(result.treatment));
      showFeedback(treatment.id, {
        type: "success",
        message: nextIsActive
          ? "Tratamentul a fost activat."
          : "Tratamentul a fost dezactivat.",
      });
      router.refresh();
    } catch {
      showFeedback(treatment.id, {
        type: "error",
        message:
          "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      setPendingOperation(null);
    }
  }

  async function archiveTreatment(
    treatment: StudentTreatmentCardData,
  ) {
    if (pendingOperation) {
      return;
    }

    setPendingOperation({
      kind: "archive",
      treatmentId: treatment.id,
    });
    clearFeedback(treatment.id);

    try {
      const response = await fetch(
        `/api/student-treatments/${encodeURIComponent(treatment.id)}`,
        {
          method: "DELETE",
        },
      );
      const result = await readApiResponse(response);

      if (!response.ok) {
        showFeedback(treatment.id, {
          type: "error",
          message:
            result.error ??
            "Tratamentul nu a putut fi arhivat.",
        });
        return;
      }

      setTreatments((currentTreatments) =>
        currentTreatments.filter(
          (currentTreatment) =>
            currentTreatment.id !== treatment.id,
        ),
      );
      clearFeedback(treatment.id);
      router.refresh();
    } catch {
      showFeedback(treatment.id, {
        type: "error",
        message:
          "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      setPendingOperation(null);
    }
  }

  function confirmArchive() {
    if (!archiveCandidate) {
      return;
    }

    const treatment = archiveCandidate;

    setArchiveCandidate(null);
    void archiveTreatment(treatment);
  }

  return (
    <>
      <Link
        href="/cont"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        ← Înapoi la cont
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Profil profesional
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Tratamente
          </h1>

          <p className="text-muted-foreground">
            Configurează tratamentele pe care le oferi, durata lor
            și locațiile în care pot fi programate.
          </p>
        </div>

        <Button asChild>
          <Link href="/cont/tratamente/nou">
            <Plus aria-hidden="true" />
            Adaugă tratament
          </Link>
        </Button>
      </div>

      {!hasStudentProfile ? (
        <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Completează mai întâi{" "}
          <Link
            href="/cont/profil-student"
            className="font-medium text-foreground underline underline-offset-4"
          >
            profilul profesional
          </Link>{" "}
          pentru a putea administra tratamente.
        </p>
      ) : null}

      {treatments.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {treatments.map((treatment) => (
            <StudentTreatmentCard
              key={treatment.id}
              treatment={treatment}
              isPending={
                pendingOperation?.treatmentId === treatment.id
              }
              isDisabled={pendingOperation !== null}
              feedback={cardFeedback[treatment.id] ?? null}
              onToggleActive={toggleTreatment}
              onArchive={setArchiveCandidate}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
              <Stethoscope
                className="size-5"
                aria-hidden="true"
              />
            </span>

            <h2 className="text-lg font-semibold">
              Nu ai adăugat niciun tratament
            </h2>

            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {hasStudentProfile
                ? "Adaugă primul tratament din catalog și asociază numai locațiile în care îl oferi."
                : "Completează mai întâi datele generale ale profilului profesional."}
            </p>

            <p className="mt-4 max-w-xl text-xs text-muted-foreground">
              Un tratament fără nicio locație activă asociată va fi
              creat inactiv și va putea fi activat ulterior.
            </p>
          </CardContent>
        </Card>
      )}

      <StudentTreatmentArchiveDialog
        treatmentName={archiveCandidate?.name ?? null}
        isPending={false}
        onCancel={() => setArchiveCandidate(null)}
        onConfirm={confirmArchive}
      />
    </>
  );
}
