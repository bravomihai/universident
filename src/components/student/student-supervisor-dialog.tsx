"use client";

import {
  StudentSupervisorForm,
  type StudentSupervisorOption,
} from "@/components/student/student-supervisor-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentSupervisorDialogProps = {
  open: boolean;
  supervisor?: StudentSupervisorOption;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (supervisor: StudentSupervisorOption) => void;
};

export function StudentSupervisorDialog({
  open,
  supervisor,
  disabled = false,
  onOpenChange,
  onSaved,
}: StudentSupervisorDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {supervisor
              ? "Editează profesorul supervizor"
              : "Adaugă un profesor supervizor"}
          </DialogTitle>
          <DialogDescription>
            Numele este obligatoriu. Titlul academic poate fi completat
            dacă este relevant.
          </DialogDescription>
        </DialogHeader>

        <StudentSupervisorForm
          key={supervisor?.id ?? "new-supervisor"}
          idPrefix={supervisor ? `supervisor-${supervisor.id}` : "supervisor-new"}
          supervisor={supervisor}
          disabled={disabled}
          onCancel={() => onOpenChange(false)}
          onSaved={(savedSupervisor) => {
            onSaved(savedSupervisor);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
