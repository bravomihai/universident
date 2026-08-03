"use client";

import { Plus, Trash2, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import { StudentSupervisorDialog } from "@/components/student/student-supervisor-dialog";
import type { StudentSupervisorOption } from "@/components/student/student-supervisor-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudentTreatmentLocationOption = {
  id: string;
  name: string;
  address: string;
  cityName: string;
  isActive: boolean;
};

export type StudentTreatmentAssignmentDraft = {
  studentLocationId: string;
  supervisorId: string;
};

type Props = {
  locations: StudentTreatmentLocationOption[];
  supervisors: StudentSupervisorOption[];
  assignments: StudentTreatmentAssignmentDraft[];
  disabled: boolean;
  onChange: (assignments: StudentTreatmentAssignmentDraft[]) => void;
};

function supervisorLabel(supervisor: StudentSupervisorOption) {
  return [supervisor.academicTitle, supervisor.fullName]
    .filter(Boolean)
    .join(" ");
}

export function StudentTreatmentAssignmentEditor({
  locations,
  supervisors,
  assignments,
  disabled,
  onChange,
}: Props) {
  const [availableSupervisors, setAvailableSupervisors] =
    useState(supervisors);
  const [supervisorDialogTarget, setSupervisorDialogTarget] = useState<
    number | "list" | null
  >(null);

  function updateAssignment(
    index: number,
    patch: Partial<StudentTreatmentAssignmentDraft>,
  ) {
    onChange(
      assignments.map((assignment, assignmentIndex) =>
        assignmentIndex === index
          ? { ...assignment, ...patch }
          : assignment,
      ),
    );
  }

  function addAssignment() {
    const selectedLocationIds = new Set(
      assignments.map((assignment) => assignment.studentLocationId),
    );
    const firstAvailableLocation = locations.find(
      (location) =>
        location.isActive && !selectedLocationIds.has(location.id),
    );

    onChange([
      ...assignments,
      {
        studentLocationId: firstAvailableLocation?.id ?? "",
        supervisorId: "",
      },
    ]);
  }

  const activeUnselectedLocations = locations.filter(
    (location) =>
      location.isActive &&
      !assignments.some(
        (assignment) => assignment.studentLocationId === location.id,
      ),
  );
  const hasActiveSupervisors = availableSupervisors.some(
    (supervisor) =>
      supervisor.isActive && supervisor.deletedAt === null,
  );

  return (
    <div className="space-y-4">
      {!hasActiveSupervisors ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Nu ai supervizori activi.
            </p>
            <p className="text-sm text-muted-foreground">
              Adaugă un profesor supervizor înainte de salvarea unei
              asocieri.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setSupervisorDialogTarget("list")}
          >
            <UserRoundPlus aria-hidden="true" />
            Adaugă un supervizor
          </Button>
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-5">
          <p className="text-sm font-medium">
            Nicio locație și niciun profesor asociat
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tratamentul poate fi salvat inactiv. Pentru activare este
            necesară cel puțin o asociere completă.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment, index) => {
            const location = locations.find(
              (option) => option.id === assignment.studentLocationId,
            );
            const supervisor = availableSupervisors.find(
              (option) => option.id === assignment.supervisorId,
            );
            const supervisorUnavailable =
              supervisor &&
              (!supervisor.isActive || supervisor.deletedAt !== null);

            return (
              <div
                key={`${assignment.studentLocationId || "new"}-${index}`}
                className="space-y-3 rounded-2xl border bg-muted/20 p-4"
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`assignment-location-${index}`}>
                      Locație
                    </Label>
                    <Select
                      value={assignment.studentLocationId || undefined}
                      disabled={disabled}
                      onValueChange={(studentLocationId) =>
                        updateAssignment(index, { studentLocationId })
                      }
                    >
                      <SelectTrigger
                        id={`assignment-location-${index}`}
                        className="w-full min-w-0"
                      >
                        <SelectValue placeholder="Selectează locația" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((option) => {
                          const usedElsewhere = assignments.some(
                            (candidate, candidateIndex) =>
                              candidateIndex !== index &&
                              candidate.studentLocationId === option.id,
                          );
                          return (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              disabled={!option.isActive || usedElsewhere}
                            >
                              {option.name} · {option.cityName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`assignment-supervisor-${index}`}>
                      Profesor supervizor
                    </Label>
                    <Select
                      value={assignment.supervisorId || undefined}
                      disabled={disabled}
                      onValueChange={(supervisorId) =>
                        updateAssignment(index, { supervisorId })
                      }
                    >
                      <SelectTrigger
                        id={`assignment-supervisor-${index}`}
                        className="w-full min-w-0"
                      >
                        <SelectValue placeholder="Selectează profesorul" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSupervisors.map((option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id}
                            disabled={
                              !option.isActive || option.deletedAt !== null
                            }
                          >
                            {supervisorLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={disabled}
                    aria-label="Elimină asocierea"
                    onClick={() =>
                      onChange(
                        assignments.filter(
                          (_, assignmentIndex) => assignmentIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>

                {location ? (
                  <p className="text-xs text-muted-foreground">
                    {location.address}
                    {!location.isActive ? " · Locație indisponibilă" : ""}
                  </p>
                ) : (
                  <p role="alert" className="text-sm text-destructive">
                    Selectează o locație disponibilă.
                  </p>
                )}

                {!assignment.supervisorId ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Selectează un profesor pentru această locație.
                  </p>
                ) : supervisorUnavailable || !supervisor ? (
                  <p role="alert" className="text-sm text-destructive">
                    Profesorul asociat nu mai este disponibil. Alege altul.
                  </p>
                ) : null}

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setSupervisorDialogTarget(index)}
                  >
                    <UserRoundPlus aria-hidden="true" />
                    Adaugă un supervizor
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={disabled || activeUnselectedLocations.length === 0}
        onClick={addAssignment}
      >
        <Plus aria-hidden="true" />
        Adaugă locație și profesor
      </Button>

      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nu ai nicio locație disponibilă. Adaugă sau reactivează o
          locație înainte de a crea o asociere.
        </p>
      ) : null}

      <StudentSupervisorDialog
        open={supervisorDialogTarget !== null}
        disabled={disabled}
        onOpenChange={(open) => {
          if (!open) setSupervisorDialogTarget(null);
        }}
        onSaved={(savedSupervisor) => {
          setAvailableSupervisors((current) => {
            const exists = current.some(
              (option) => option.id === savedSupervisor.id,
            );
            return exists
              ? current.map((option) =>
                  option.id === savedSupervisor.id
                    ? savedSupervisor
                    : option,
                )
              : [...current, savedSupervisor];
          });
          if (typeof supervisorDialogTarget === "number") {
            updateAssignment(supervisorDialogTarget, {
              supervisorId: savedSupervisor.id,
            });
          }
        }}
      />
    </div>
  );
}
