"use client";

import { Archive } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ArchivedStudentLocationCard,
  ArchivedStudentTreatmentCard,
  type ArchivedStudentLocationCardData,
  type ArchivedStudentTreatmentCardData,
} from "@/components/student/student-archived-resource-card";
import {
  ArchivedLocationRestoreDialog,
  ArchivedTreatmentRestoreDialog,
} from "@/components/student/student-archived-resource-dialogs";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

type StudentArchivedResourcesManagerProps = {
  initialLocations: ArchivedStudentLocationCardData[];
  initialTreatments: ArchivedStudentTreatmentCardData[];
  hasStudentProfile: boolean;
};

type RestoreCandidate =
  | {
      kind: "location";
      resource: ArchivedStudentLocationCardData;
    }
  | {
      kind: "treatment";
      resource: ArchivedStudentTreatmentCardData;
    };

type PendingRestore = {
  kind: RestoreCandidate["kind"];
  resourceId: string;
};

type RestoreApiResponse = {
  error?: string;
  message?: string;
  restoredLocation?: {
    id: string;
  };
  restoredTreatment?: {
    id: string;
  };
};

function feedbackKey(
  kind: RestoreCandidate["kind"],
  resourceId: string,
) {
  return `${kind}:${resourceId}`;
}

async function readApiResponse(
  response: Response,
): Promise<RestoreApiResponse> {
  try {
    return (await response.json()) as RestoreApiResponse;
  } catch {
    return {};
  }
}

export function StudentArchivedResourcesManager({
  initialLocations,
  initialTreatments,
  hasStudentProfile,
}: StudentArchivedResourcesManagerProps) {
  const router = useRouter();
  const [locations, setLocations] = useState(initialLocations);
  const [treatments, setTreatments] =
    useState(initialTreatments);
  const [restoreCandidate, setRestoreCandidate] =
    useState<RestoreCandidate | null>(null);
  const [pendingRestore, setPendingRestore] =
    useState<PendingRestore | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(
    null,
  );
  const isMounted = useRef(true);
  const {
    feedbackById,
    showFeedback,
    clearFeedback,
  } = useCardFeedback();

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pageMessage) {
      return;
    }

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setPageMessage(null);
      }
    }, 5_000);

    return () => {
      clearTimeout(timer);
    };
  }, [pageMessage]);

  function openRestoreDialog(candidate: RestoreCandidate) {
    clearFeedback(
      feedbackKey(candidate.kind, candidate.resource.id),
    );
    setRestoreCandidate(candidate);
  }

  async function restoreResource(candidate: RestoreCandidate) {
    if (pendingRestore) {
      return;
    }

    const resourceId = candidate.resource.id;
    const resourceFeedbackKey = feedbackKey(
      candidate.kind,
      resourceId,
    );

    setRestoreCandidate(null);
    setPendingRestore({
      kind: candidate.kind,
      resourceId,
    });
    setPageMessage(null);
    clearFeedback(resourceFeedbackKey);

    try {
      const response = await fetch(
        candidate.kind === "location"
          ? `/api/student-locations/${encodeURIComponent(
              resourceId,
            )}/restore`
          : `/api/student-treatments/${encodeURIComponent(
              resourceId,
            )}/restore`,
        {
          method: "POST",
        },
      );
      const result = await readApiResponse(response);

      if (!isMounted.current) {
        return;
      }

      const hasExpectedResource =
        candidate.kind === "location"
          ? result.restoredLocation?.id === resourceId
          : result.restoredTreatment?.id === resourceId;

      if (!response.ok || !hasExpectedResource) {
        showFeedback(resourceFeedbackKey, {
          type: "error",
          message:
            result.error ??
            (candidate.kind === "location"
              ? "Locația nu a putut fi restaurată."
              : "Tratamentul nu a putut fi restaurat."),
        });
        return;
      }

      if (candidate.kind === "location") {
        setLocations((currentLocations) =>
          currentLocations.filter(
            (location) => location.id !== resourceId,
          ),
        );
      } else {
        setTreatments((currentTreatments) =>
          currentTreatments.filter(
            (treatment) => treatment.id !== resourceId,
          ),
        );
      }

      clearFeedback(resourceFeedbackKey);
      setPageMessage(
        result.message ??
          (candidate.kind === "location"
            ? "Locația a fost restaurată ca inactivă."
            : "Tratamentul a fost restaurat ca inactiv."),
      );
      router.refresh();
    } catch {
      if (!isMounted.current) {
        return;
      }

      showFeedback(resourceFeedbackKey, {
        type: "error",
        message:
          "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      if (isMounted.current) {
        setPendingRestore(null);
      }
    }
  }

  const hasArchivedResources =
    locations.length > 0 || treatments.length > 0;

  return (
    <>
      <Link
        href="/cont"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        ← Înapoi la cont
      </Link>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Contul meu
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Resurse arhivate
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Consultă locațiile și tratamentele eliminate din listele
          obișnuite și restaurează-le când ai din nou nevoie de ele.
          Resursele restaurate revin inactive.
        </p>
      </div>

      {pageMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-foreground"
        >
          {pageMessage}
        </p>
      ) : null}

      {!hasStudentProfile ? (
        <p className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Completează mai întâi{" "}
          <Link
            href="/cont/profil-student"
            className="font-medium text-foreground underline underline-offset-4"
          >
            profilul profesional
          </Link>{" "}
          pentru a putea administra resurse.
        </p>
      ) : null}

      {!hasArchivedResources ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
              <Archive className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">
              Nu ai resurse arhivate.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Locațiile și tratamentele arhivate vor apărea aici.
            </p>
            <Link
              href="/cont"
              className="mt-4 text-sm font-medium underline underline-offset-4"
            >
              Înapoi la cont
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section
          aria-labelledby="archived-locations-title"
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="archived-locations-title"
              className="text-xl font-semibold tracking-tight"
            >
              Locații arhivate
            </h2>
            <span className="text-sm text-muted-foreground">
              {locations.length}
            </span>
          </div>

          {locations.length > 0 ? (
            <div className="space-y-4">
              {locations.map((location) => {
                const resourceFeedbackKey = feedbackKey(
                  "location",
                  location.id,
                );

                return (
                  <ArchivedStudentLocationCard
                    key={location.id}
                    location={location}
                    isPending={
                      pendingRestore?.kind === "location" &&
                      pendingRestore.resourceId === location.id
                    }
                    isDisabled={pendingRestore !== null}
                    feedback={
                      feedbackById[resourceFeedbackKey] ?? null
                    }
                    onRestore={(selectedLocation) =>
                      openRestoreDialog({
                        kind: "location",
                        resource: selectedLocation,
                      })
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              Nu ai locații arhivate.
            </p>
          )}
        </section>

        <section
          aria-labelledby="archived-treatments-title"
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="archived-treatments-title"
              className="text-xl font-semibold tracking-tight"
            >
              Tratamente arhivate
            </h2>
            <span className="text-sm text-muted-foreground">
              {treatments.length}
            </span>
          </div>

          {treatments.length > 0 ? (
            <div className="space-y-4">
              {treatments.map((treatment) => {
                const resourceFeedbackKey = feedbackKey(
                  "treatment",
                  treatment.id,
                );

                return (
                  <ArchivedStudentTreatmentCard
                    key={treatment.id}
                    treatment={treatment}
                    isPending={
                      pendingRestore?.kind === "treatment" &&
                      pendingRestore.resourceId === treatment.id
                    }
                    isDisabled={pendingRestore !== null}
                    feedback={
                      feedbackById[resourceFeedbackKey] ?? null
                    }
                    onRestore={(selectedTreatment) =>
                      openRestoreDialog({
                        kind: "treatment",
                        resource: selectedTreatment,
                      })
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              Nu ai tratamente arhivate.
            </p>
          )}
        </section>
      </div>

      <ArchivedLocationRestoreDialog
        locationName={
          restoreCandidate?.kind === "location"
            ? restoreCandidate.resource.name
            : null
        }
        isPending={pendingRestore !== null}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate?.kind === "location") {
            void restoreResource(restoreCandidate);
          }
        }}
      />

      <ArchivedTreatmentRestoreDialog
        treatmentName={
          restoreCandidate?.kind === "treatment"
            ? restoreCandidate.resource.treatment.name
            : null
        }
        isPending={pendingRestore !== null}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate?.kind === "treatment") {
            void restoreResource(restoreCandidate);
          }
        }}
      />
    </>
  );
}
