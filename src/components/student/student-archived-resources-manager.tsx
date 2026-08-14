"use client";

import { Archive } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ArchivedStudentLocationCard,
  ArchivedStudentSupervisorCard,
  ArchivedStudentTreatmentCard,
  type ArchivedStudentLocationCardData,
  type ArchivedStudentSupervisorCardData,
  type ArchivedStudentTreatmentCardData,
} from "@/components/student/student-archived-resource-card";
import {
  ArchivedLocationRestoreDialog,
  ArchivedSupervisorRestoreDialog,
  ArchivedTreatmentRestoreDialog,
} from "@/components/student/student-archived-resource-dialogs";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";

type StudentArchivedResourcesManagerProps = {
  initialLocations: ArchivedStudentLocationCardData[];
  initialTreatments: ArchivedStudentTreatmentCardData[];
  initialSupervisors: ArchivedStudentSupervisorCardData[];
  hasStudentProfile: boolean;
};

type RestoreCandidate =
  | { kind: "location"; resource: ArchivedStudentLocationCardData }
  | { kind: "treatment"; resource: ArchivedStudentTreatmentCardData }
  | { kind: "supervisor"; resource: ArchivedStudentSupervisorCardData };

type PendingRestore = {
  kind: RestoreCandidate["kind"];
  resourceId: string;
};

type RestoreApiResponse = {
  error?: string;
  message?: string;
  restoredLocation?: { id: string };
  restoredTreatment?: { id: string };
  restoredSupervisor?: { id: string };
};

function feedbackKey(kind: RestoreCandidate["kind"], resourceId: string) {
  return `${kind}:${resourceId}`;
}

async function readApiResponse(response: Response): Promise<RestoreApiResponse> {
  try {
    return (await response.json()) as RestoreApiResponse;
  } catch {
    return {};
  }
}

function restoreEndpoint(candidate: RestoreCandidate) {
  const resourceId = encodeURIComponent(candidate.resource.id);
  if (candidate.kind === "location") {
    return `/api/student-locations/${resourceId}/restore`;
  }
  if (candidate.kind === "treatment") {
    return `/api/student-treatments/${resourceId}/restore`;
  }
  return `/api/student-supervisors/${resourceId}/restore`;
}

function genericRestoreError(kind: RestoreCandidate["kind"]) {
  if (kind === "location") return "Locația nu a putut fi restaurată.";
  if (kind === "treatment") return "Tratamentul nu a putut fi restaurat.";
  return "Profesorul supervizor nu a putut fi restaurat.";
}

function genericRestoreSuccess(kind: RestoreCandidate["kind"]) {
  if (kind === "location") return "Locația a fost restaurată.";
  if (kind === "treatment") return "Tratamentul a fost restaurat.";
  return "Profesorul supervizor a fost restaurat.";
}

export function StudentArchivedResourcesManager({
  initialLocations,
  initialTreatments,
  initialSupervisors,
  hasStudentProfile,
}: StudentArchivedResourcesManagerProps) {
  const router = useRouter();
  const [locations, setLocations] = useState(initialLocations);
  const [treatments, setTreatments] = useState(initialTreatments);
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [restoreCandidate, setRestoreCandidate] =
    useState<RestoreCandidate | null>(null);
  const [pendingRestore, setPendingRestore] =
    useState<PendingRestore | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { feedbackById, showFeedback, clearFeedback } = useCardFeedback();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pageMessage) return;
    const timer = setTimeout(() => {
      if (isMounted.current) setPageMessage(null);
    }, 5_000);
    return () => clearTimeout(timer);
  }, [pageMessage]);

  function openRestoreDialog(candidate: RestoreCandidate) {
    clearFeedback(feedbackKey(candidate.kind, candidate.resource.id));
    setRestoreCandidate(candidate);
  }

  async function restoreResource(candidate: RestoreCandidate) {
    if (pendingRestore) return;

    const resourceId = candidate.resource.id;
    const resourceFeedbackKey = feedbackKey(candidate.kind, resourceId);
    setRestoreCandidate(null);
    setPendingRestore({ kind: candidate.kind, resourceId });
    setPageMessage(null);
    clearFeedback(resourceFeedbackKey);

    try {
      const response = await fetch(restoreEndpoint(candidate), {
        method: "POST",
      });
      const result = await readApiResponse(response);
      if (!isMounted.current) return;

      const restoredId =
        candidate.kind === "location"
          ? result.restoredLocation?.id
          : candidate.kind === "treatment"
            ? result.restoredTreatment?.id
            : result.restoredSupervisor?.id;

      if (!response.ok || restoredId !== resourceId) {
        showFeedback(resourceFeedbackKey, {
          type: "error",
          message: result.error ?? genericRestoreError(candidate.kind),
        });
        return;
      }

      if (candidate.kind === "location") {
        setLocations((current) =>
          current.filter((resource) => resource.id !== resourceId),
        );
      } else if (candidate.kind === "treatment") {
        setTreatments((current) =>
          current.filter((resource) => resource.id !== resourceId),
        );
      } else {
        setSupervisors((current) =>
          current.filter((resource) => resource.id !== resourceId),
        );
      }

      clearFeedback(resourceFeedbackKey);
      setPageMessage(result.message ?? genericRestoreSuccess(candidate.kind));
      router.refresh();
    } catch {
      if (!isMounted.current) return;
      showFeedback(resourceFeedbackKey, {
        type: "error",
        message: "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      if (isMounted.current) setPendingRestore(null);
    }
  }

  const hasArchivedResources =
    locations.length > 0 || treatments.length > 0 || supervisors.length > 0;

  return (
    <>
      <BackLink href="/cont">Înapoi la cont</BackLink>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
            <Archive className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Resurse arhivate
          </h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Consultă tratamentele, locațiile și profesorii supervizori arhivați.
          Resursele pot fi restaurate folosind regulile fiecărei categorii.
        </p>
      </div>

      {pageMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border bg-muted/30 px-4 py-3 text-sm"
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
            <h2 className="text-lg font-semibold">Nu ai resurse arhivate.</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Tratamentele, locațiile și supervizorii arhivați vor apărea aici.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="archived-treatments-title" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="archived-treatments-title" className="text-xl font-semibold tracking-tight">
              Tratamente
            </h2>
            <span className="text-sm text-muted-foreground">{treatments.length}</span>
          </div>
          {treatments.length > 0 ? (
            <div className="space-y-4">
              {treatments.map((treatment) => {
                const key = feedbackKey("treatment", treatment.id);
                return (
                  <ArchivedStudentTreatmentCard
                    key={treatment.id}
                    treatment={treatment}
                    isPending={pendingRestore?.kind === "treatment" && pendingRestore.resourceId === treatment.id}
                    isDisabled={pendingRestore !== null}
                    feedback={feedbackById[key] ?? null}
                    onRestore={(resource) => openRestoreDialog({ kind: "treatment", resource })}
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

        <section aria-labelledby="archived-locations-title" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="archived-locations-title" className="text-xl font-semibold tracking-tight">
              Locații
            </h2>
            <span className="text-sm text-muted-foreground">{locations.length}</span>
          </div>
          {locations.length > 0 ? (
            <div className="space-y-4">
              {locations.map((location) => {
                const key = feedbackKey("location", location.id);
                return (
                  <ArchivedStudentLocationCard
                    key={location.id}
                    location={location}
                    isPending={pendingRestore?.kind === "location" && pendingRestore.resourceId === location.id}
                    isDisabled={pendingRestore !== null}
                    feedback={feedbackById[key] ?? null}
                    onRestore={(resource) => openRestoreDialog({ kind: "location", resource })}
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

        <section aria-labelledby="archived-supervisors-title" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="archived-supervisors-title" className="text-xl font-semibold tracking-tight">
              Supervizori
            </h2>
            <span className="text-sm text-muted-foreground">{supervisors.length}</span>
          </div>
          {supervisors.length > 0 ? (
            <div className="space-y-4">
              {supervisors.map((supervisor) => {
                const key = feedbackKey("supervisor", supervisor.id);
                return (
                  <ArchivedStudentSupervisorCard
                    key={supervisor.id}
                    supervisor={supervisor}
                    isPending={pendingRestore?.kind === "supervisor" && pendingRestore.resourceId === supervisor.id}
                    isDisabled={pendingRestore !== null}
                    feedback={feedbackById[key] ?? null}
                    onRestore={(resource) => openRestoreDialog({ kind: "supervisor", resource })}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              Nu ai supervizori arhivați.
            </p>
          )}
        </section>
      </div>

      <ArchivedLocationRestoreDialog
        locationName={restoreCandidate?.kind === "location" ? restoreCandidate.resource.name : null}
        isPending={pendingRestore !== null}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate?.kind === "location") void restoreResource(restoreCandidate);
        }}
      />
      <ArchivedTreatmentRestoreDialog
        treatmentName={restoreCandidate?.kind === "treatment" ? restoreCandidate.resource.treatment.name : null}
        isPending={pendingRestore !== null}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate?.kind === "treatment") void restoreResource(restoreCandidate);
        }}
      />
      <ArchivedSupervisorRestoreDialog
        supervisorName={restoreCandidate?.kind === "supervisor" ? restoreCandidate.resource.fullName : null}
        isPending={pendingRestore !== null}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate?.kind === "supervisor") void restoreResource(restoreCandidate);
        }}
      />
    </>
  );
}
