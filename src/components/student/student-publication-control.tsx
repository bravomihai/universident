"use client";

import { ExternalLink, Globe2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { StudentPublicationRequirement } from "@/lib/student-publication/student-publication-readiness";
import { cn } from "@/lib/utils";

type StudentPublicationControlState = {
  isPublished: boolean;
  isPubliclyVisible: boolean;
  canPublish: boolean;
  publicPath: string | null;
  missingRequirements: StudentPublicationRequirement[];
};

type StudentPublicationControlProps = {
  initialState: StudentPublicationControlState;
  className?: string;
};

type PublicationResponse = {
  error?: string;
  isPublished?: boolean;
  isPubliclyVisible?: boolean;
  publicPath?: string | null;
  missingRequirements?: StudentPublicationRequirement[];
};

function publicationLabel(state: StudentPublicationControlState) {
  if (state.isPubliclyVisible) return "Publicat";
  if (!state.canPublish || state.isPublished) return "Necesită completări";
  return "Nepublicat";
}

export function StudentPublicationControl({
  initialState,
  className,
}: StudentPublicationControlProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const label = publicationLabel(state);

  async function updatePublication(isPublished: boolean) {
    if (isPending) return;

    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/student-profile/publication", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      const result = (await response.json()) as PublicationResponse;

      if (!response.ok) {
        if (result.missingRequirements) {
          setState((current) => ({
            ...current,
            canPublish: false,
            isPubliclyVisible: false,
            missingRequirements: result.missingRequirements ?? [],
          }));
        }
        setErrorMessage(
          result.error ?? "Vizibilitatea profilului nu a putut fi actualizată.",
        );
        return;
      }

      setState((current) => ({
        ...current,
        isPublished: result.isPublished ?? isPublished,
        isPubliclyVisible: result.isPubliclyVisible ?? isPublished,
        publicPath: result.publicPath ?? current.publicPath,
      }));
      setSuccessMessage(
        isPublished
          ? "Profilul profesional este acum public."
          : "Profilul a fost retras din publicare. Datele profesionale au fost păstrate.",
      );
      router.refresh();
    } catch {
      setErrorMessage("A apărut o eroare de conexiune. Încearcă din nou.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3 border-t pt-4", className)}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
          <Globe2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-semibold">Vizibilitate publică</h2>
          <p className="text-sm text-muted-foreground">
            Controlează dacă profilul tău poate fi găsit de pacienți.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            label === "Publicat"
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : label === "Necesită completări"
                ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "bg-muted/30"
          }`}
        >
          {label}
        </span>
      </div>

      {state.isPubliclyVisible ? (
        <p className="text-sm text-muted-foreground">
          Retragerea oprește afișarea publică și nu șterge datele profesionale.
        </p>
      ) : state.missingRequirements.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Pentru ca profilul să fie vizibil, completează:
          </p>
          <ul className="space-y-1 text-sm">
            {state.missingRequirements.map((requirement) => (
              <li key={requirement.code}>
                <Link
                  href={requirement.href}
                  className="font-medium underline underline-offset-4"
                >
                  {requirement.message}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Profilul este complet, dar nu este vizibil public până când alegi să
          îl publici.
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {state.isPubliclyVisible && state.publicPath ? (
          <Button asChild variant="outline" size="sm">
            <Link href={state.publicPath}>
              Vezi profilul public
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : null}

        {state.canPublish && !state.isPublished ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => void updatePublication(true)}
          >
            {isPending ? "Se publică..." : "Publică profilul"}
          </Button>
        ) : null}

        {state.isPublished ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => void updatePublication(false)}
          >
            {isPending ? "Se retrage..." : "Retrage din publicare"}
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" aria-live="polite" className="text-sm">
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
