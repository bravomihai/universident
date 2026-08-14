"use client";

import { Archive, Pencil, Plus, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StudentCardFeedbackMessage } from "@/components/student/student-card-feedback";
import { StudentProfessionalNavigation } from "@/components/student/student-professional-navigation";
import { StudentSupervisorDialog } from "@/components/student/student-supervisor-dialog";
import type { StudentSupervisorOption } from "@/components/student/student-supervisor-form";
import { useCardFeedback } from "@/components/student/use-card-feedback";
import { BackLink } from "@/components/ui/back-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type StudentSupervisorListItem = StudentSupervisorOption & {
  createdAt: string;
  updatedAt: string;
};

type StudentSupervisorsManagerProps = {
  initialSupervisors: StudentSupervisorListItem[];
  hasStudentProfile: boolean;
};

type ApiResponse = {
  error?: string;
  archivedSupervisorId?: string;
};

function sortSupervisors(supervisors: StudentSupervisorListItem[]) {
  return [...supervisors].sort((first, second) =>
    first.fullName.localeCompare(second.fullName, "ro"),
  );
}

export function StudentSupervisorsManager({
  initialSupervisors,
  hasStudentProfile,
}: StudentSupervisorsManagerProps) {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState(
    sortSupervisors(initialSupervisors),
  );
  const [editor, setEditor] = useState<
    { supervisor?: StudentSupervisorListItem } | null
  >(null);
  const [archiveCandidate, setArchiveCandidate] =
    useState<StudentSupervisorListItem | null>(null);
  const [pendingSupervisorId, setPendingSupervisorId] = useState<
    string | null
  >(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const { feedbackById, showFeedback, clearFeedback } = useCardFeedback();

  function saveSupervisor(savedSupervisor: StudentSupervisorOption) {
    setSupervisors((current) => {
      const existing = current.find(
        (supervisor) => supervisor.id === savedSupervisor.id,
      );
      const nextSupervisor: StudentSupervisorListItem = {
        ...savedSupervisor,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return sortSupervisors(
        existing
          ? current.map((supervisor) =>
              supervisor.id === savedSupervisor.id
                ? nextSupervisor
                : supervisor,
            )
          : [...current, nextSupervisor],
      );
    });
    clearFeedback(savedSupervisor.id);
    setPageMessage(
      editor?.supervisor
        ? "Profesorul supervizor a fost actualizat."
        : "Profesorul supervizor a fost adăugat.",
    );
    setEditor(null);
    router.refresh();
  }

  async function archiveSupervisor(supervisor: StudentSupervisorListItem) {
    if (pendingSupervisorId) return;

    setArchiveCandidate(null);
    setPendingSupervisorId(supervisor.id);
    setPageMessage(null);
    clearFeedback(supervisor.id);

    try {
      const response = await fetch(
        `/api/student-supervisors/${encodeURIComponent(supervisor.id)}`,
        { method: "DELETE" },
      );
      let result: ApiResponse = {};
      try {
        result = (await response.json()) as ApiResponse;
      } catch {
        // Mesajul generic nu expune detalii interne.
      }

      if (!response.ok || result.archivedSupervisorId !== supervisor.id) {
        showFeedback(supervisor.id, {
          type: "error",
          message:
            result.error ??
            "Profesorul supervizor nu a putut fi arhivat.",
        });
        return;
      }

      setSupervisors((current) =>
        current.filter((candidate) => candidate.id !== supervisor.id),
      );
      setPageMessage("Profesorul supervizor a fost arhivat.");
      router.refresh();
    } catch {
      showFeedback(supervisor.id, {
        type: "error",
        message: "A apărut o eroare de conexiune. Încearcă din nou.",
      });
    } finally {
      setPendingSupervisorId(null);
    }
  }

  return (
    <>
      <BackLink href="/cont">Înapoi la cont</BackLink>

      <StudentProfessionalNavigation current="supervisors" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              Supervizori
            </h1>
          </div>
          <p className="text-muted-foreground">
            Administrează profesorii pe care îi poți selecta pentru
            tratamentele fiecărui interval din calendar.
          </p>
        </div>

        <Button
          type="button"
          disabled={!hasStudentProfile}
          onClick={() => setEditor({})}
        >
          <Plus aria-hidden="true" />
          Adaugă supervizor
        </Button>
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
          pentru a putea administra supervizori.
        </p>
      ) : null}

      {supervisors.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {supervisors.map((supervisor) => (
            <Card size="sm" className="h-fit self-start" key={supervisor.id} aria-busy={pendingSupervisorId === supervisor.id}>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold leading-snug">
                    {supervisor.academicTitle ? `${supervisor.academicTitle} ` : null}
                    {supervisor.fullName}
                  </h2>
                  <UserRound
                    className="size-4 shrink-0 stroke-[2.5] text-foreground"
                    aria-hidden="true"
                  />
                </div>

                <StudentCardFeedbackMessage
                  feedback={feedbackById[supervisor.id] ?? null}
                />

                <div className="grid grid-cols-2 gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={pendingSupervisorId !== null}
                    onClick={() => setEditor({ supervisor })}
                  >
                    <Pencil aria-hidden="true" />
                    Editează
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={pendingSupervisorId !== null}
                    onClick={() => setArchiveCandidate(supervisor)}
                  >
                    <Archive aria-hidden="true" />
                    Arhivează
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">
              Nu ai adăugat niciun supervizor
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Adaugă primul profesor pentru a-l putea selecta în calendar.
            </p>
          </CardContent>
        </Card>
      )}

      <StudentSupervisorDialog
        open={editor !== null}
        supervisor={editor?.supervisor}
        disabled={pendingSupervisorId !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        onSaved={saveSupervisor}
      />

      <AlertDialog
        open={archiveCandidate !== null}
        onOpenChange={(open) => {
          if (!open && !pendingSupervisorId) setArchiveCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Archive aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Arhivezi profesorul „{archiveCandidate?.fullName}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Profesorul nu mai poate fi selectat până la restaurare. Dacă
              este folosit într-o apariție viitoare, arhivarea va fi blocată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingSupervisorId !== null}>
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingSupervisorId !== null}
              onClick={() => {
                if (archiveCandidate) void archiveSupervisor(archiveCandidate);
              }}
            >
              Arhivează
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
