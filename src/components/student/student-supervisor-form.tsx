"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StudentSupervisorOption = {
  id: string;
  fullName: string;
  academicTitle: string | null;
  isActive: boolean;
  deletedAt: string | null;
};

type StudentSupervisorFormProps = {
  idPrefix: string;
  supervisor?: StudentSupervisorOption;
  disabled?: boolean;
  onCancel: () => void;
  onSaved: (supervisor: StudentSupervisorOption) => void;
};

type ApiResponse = {
  error?: string;
  supervisor?: StudentSupervisorOption;
};

export function StudentSupervisorForm({
  idPrefix,
  supervisor,
  disabled = false,
  onCancel,
  onSaved,
}: StudentSupervisorFormProps) {
  const [fullName, setFullName] = useState(supervisor?.fullName ?? "");
  const [academicTitle, setAcademicTitle] = useState(
    supervisor?.academicTitle ?? "",
  );
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function saveSupervisor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isPending) return;

    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        supervisor
          ? `/api/student-supervisors/${encodeURIComponent(supervisor.id)}`
          : "/api/student-supervisors",
        {
          method: supervisor ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, academicTitle }),
        },
      );

      let result: ApiResponse = {};
      try {
        result = (await response.json()) as ApiResponse;
      } catch {
        // Mesajul generic nu expune detalii interne.
      }

      if (!response.ok || !result.supervisor) {
        setErrorMessage(
          result.error ?? "Profesorul supervizor nu a putut fi salvat.",
        );
        return;
      }

      onSaved(result.supervisor);
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const formDisabled = disabled || isPending;

  return (
    <form className="space-y-5" onSubmit={saveSupervisor}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-full-name`}>Nume complet</Label>
          <Input
            id={`${idPrefix}-full-name`}
            value={fullName}
            minLength={2}
            maxLength={120}
            disabled={formDisabled}
            required
            autoFocus
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-academic-title`}>
            Titlu academic
          </Label>
          <Input
            id={`${idPrefix}-academic-title`}
            value={academicTitle}
            minLength={2}
            maxLength={80}
            disabled={formDisabled}
            placeholder="Opțional"
            onChange={(event) => setAcademicTitle(event.target.value)}
          />
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          Anulează
        </Button>
        <Button
          type="submit"
          disabled={formDisabled || fullName.trim().length < 2}
        >
          {isPending
            ? "Se salvează..."
            : supervisor
              ? "Salvează profesorul"
              : "Adaugă profesorul"}
        </Button>
      </DialogFooter>
    </form>
  );
}
