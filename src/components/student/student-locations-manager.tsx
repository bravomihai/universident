"use client";

import { MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  StudentLocationCard,
  type StudentLocationCardData,
} from "@/components/student/student-location-card";
import {
  StudentLocationArchiveDialog,
  StudentLocationCascadeDialog,
} from "@/components/student/student-location-dialogs";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StudentLocationsManagerProps = {
  initialLocations: StudentLocationCardData[];
  hasStudentProfile: boolean;
};

type LocationMutation =
  | {
      kind: "update";
      locationId: string;
      data: {
        isActive: boolean;
      };
    }
  | {
      kind: "archive";
      locationId: string;
    };

type AffectedTreatment = {
  id: string;
  name: string;
};

type CascadeConflict = {
  mutation: LocationMutation;
  affectedTreatments: AffectedTreatment[];
};

type PendingOperation = {
  kind: "update" | "archive";
  locationId: string;
};

type ApiLocation = {
  id: string;
  cityId: string;
  routeKey: string;
  name: string;
  address: string;
  details: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  city: {
    name: string;
  };
};

type ApiResponse = {
  error?: string;
  requiresConfirmation?: boolean;
  affectedTreatments?: AffectedTreatment[];
  location?: ApiLocation;
  deactivatedTreatmentCount?: number;
};

function toLocationCardData(
  location: ApiLocation,
): StudentLocationCardData {
  return {
    id: location.id,
    cityId: location.cityId,
    routeKey: location.routeKey,
    name: location.name,
    cityName: location.city.name,
    address: location.address,
    details: location.details,
    isActive: location.isActive,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
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

export function StudentLocationsManager({
  initialLocations,
  hasStudentProfile,
}: StudentLocationsManagerProps) {
  const router = useRouter();
  const [locations, setLocations] =
    useState<StudentLocationCardData[]>(initialLocations);
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation | null>(null);
  const {
    feedbackById: cardFeedback,
    showFeedback,
    clearFeedback,
  } = useCardFeedback();
  const [cascadeConflict, setCascadeConflict] =
    useState<CascadeConflict | null>(null);
  const [archiveCandidate, setArchiveCandidate] =
    useState<StudentLocationCardData | null>(null);

  function replaceLocation(updatedLocation: StudentLocationCardData) {
    setLocations((currentLocations) =>
      currentLocations.map((location) =>
        location.id === updatedLocation.id
          ? updatedLocation
          : location,
      ),
    );
  }

  async function executeMutation(
    mutation: LocationMutation,
    confirmCascade = false,
  ) {
    if (pendingOperation) {
      return;
    }

    setPendingOperation({
      kind: mutation.kind,
      locationId: mutation.locationId,
    });
    clearFeedback(mutation.locationId);

    try {
      const isArchive = mutation.kind === "archive";
      const response = await fetch(
        `/api/student-locations/${encodeURIComponent(
          mutation.locationId,
        )}`,
        {
          method: isArchive ? "DELETE" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isArchive
              ? {
                  confirmCascade,
                }
              : {
                  ...mutation.data,
                  confirmCascade,
                },
          ),
        },
      );

      const result = await readApiResponse(response);

      if (
        response.status === 409 &&
        result.requiresConfirmation &&
        result.affectedTreatments
      ) {
        setCascadeConflict({
          mutation,
          affectedTreatments: result.affectedTreatments,
        });
        return;
      }

      if (!response.ok) {
        showFeedback(mutation.locationId, {
          type: "error",
          message:
            result.error ??
            (isArchive
              ? "Locația nu a putut fi arhivată."
              : "Locația nu a putut fi actualizată."),
        });
        return;
      }

      if (isArchive) {
        setLocations((currentLocations) =>
          currentLocations.filter(
            (location) => location.id !== mutation.locationId,
          ),
        );
        clearFeedback(mutation.locationId);
        router.refresh();
      } else if (result.location) {
        const isActivating = mutation.data.isActive;
        const deactivatedTreatmentCount =
          result.deactivatedTreatmentCount ?? 0;
        let message = isActivating
          ? "Locația a fost activată."
          : "Locația a fost dezactivată.";

        if (deactivatedTreatmentCount > 0) {
          message = `${message} Au fost dezactivate și ${deactivatedTreatmentCount} tratament(e) fără altă locație activă.`;
        }

        replaceLocation(toLocationCardData(result.location));
        showFeedback(mutation.locationId, {
          type: "success",
          message,
        });
      } else {
        showFeedback(mutation.locationId, {
          type: "error",
          message: "Răspunsul serverului nu este valid.",
        });
        return;
      }

    } catch {
      showFeedback(mutation.locationId, {
        type: "error",
        message:
          "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      setPendingOperation(null);
    }
  }

  function toggleLocation(location: StudentLocationCardData) {
    void executeMutation({
      kind: "update",
      locationId: location.id,
      data: {
        isActive: !location.isActive,
      },
    });
  }

  function confirmArchive() {
    if (!archiveCandidate) {
      return;
    }

    const locationId = archiveCandidate.id;

    setArchiveCandidate(null);
    void executeMutation({
      kind: "archive",
      locationId,
    });
  }

  function confirmCascade() {
    if (!cascadeConflict) {
      return;
    }

    const mutation = cascadeConflict.mutation;

    setCascadeConflict(null);
    void executeMutation(mutation, true);
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
            Locații
          </h1>

          <p className="text-muted-foreground">
            Adaugă locurile în care primești pacienți. Fiecare
            locație are propriul oraș, propria adresă și, ulterior,
            propriul program.
          </p>
        </div>

        <Button asChild>
          <Link href="/cont/locatii/nou">
            <Plus aria-hidden="true" />
            Adaugă locație
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
          pentru a putea administra locații.
        </p>
      ) : null}

      {locations.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {locations.map((location) => (
            <StudentLocationCard
              key={location.id}
              location={location}
              isPending={
                pendingOperation?.locationId === location.id
              }
              isDisabled={pendingOperation !== null}
              feedback={cardFeedback[location.id] ?? null}
              onToggleActive={toggleLocation}
              onArchive={setArchiveCandidate}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
              <MapPin className="size-5" aria-hidden="true" />
            </span>

            <h2 className="text-lg font-semibold">
              Nu ai adăugat nicio locație
            </h2>

            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {hasStudentProfile
                ? "Primul pas este să adaugi locul în care primești pacienți și să alegi orașul din catalogul platformei."
                : "Completează mai întâi datele generale ale profilului profesional, apoi vei putea adăuga locații."}
            </p>
          </CardContent>
        </Card>
      )}

      <StudentLocationArchiveDialog
        locationName={archiveCandidate?.name ?? null}
        isPending={false}
        onCancel={() => setArchiveCandidate(null)}
        onConfirm={confirmArchive}
      />

      <StudentLocationCascadeDialog
        affectedTreatments={
          cascadeConflict?.affectedTreatments ?? []
        }
        isPending={pendingOperation !== null}
        onCancel={() => setCascadeConflict(null)}
        onConfirm={confirmCascade}
      />
    </>
  );
}
