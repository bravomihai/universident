import { isRecord, parseIdentifier } from "@/lib/appointments/appointment-input";

export type CreateStudentTreatmentInput = {
  treatmentId: string;
  description: string | null;
  durationMinutes: number;
};

export type UpdateStudentTreatmentInput = {
  description?: string | null;
  durationMinutes?: number;
};

function parseDescription(value: unknown) {
  if (value === undefined) return { ok: true, data: undefined } as const;
  if (value === null || value === "") return { ok: true, data: null } as const;
  if (typeof value !== "string" || value.trim().length > 1000) {
    return { ok: false, error: "Descrierea poate avea cel mult 1.000 de caractere." } as const;
  }
  return { ok: true, data: value.trim() || null } as const;
}

function parseDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 15 || value > 480 || value % 15 !== 0) {
    return { ok: false, error: "Durata trebuie să fie între 15 și 480 de minute, în pași de 15 minute." } as const;
  }
  return { ok: true, data: value } as const;
}

export function parseCreateStudentTreatmentInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const treatmentId = parseIdentifier(value.treatmentId, "Tratamentul");
  if (!treatmentId.ok) return treatmentId;
  const description = parseDescription(value.description);
  if (!description.ok) return description;
  const duration = parseDuration(value.durationMinutes);
  if (!duration.ok) return duration;
  return {
    ok: true,
    data: { treatmentId: treatmentId.data, description: description.data ?? null, durationMinutes: duration.data },
  } as const;
}

export function parseUpdateStudentTreatmentInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const data: UpdateStudentTreatmentInput = {};
  if (Object.hasOwn(value, "description")) {
    const description = parseDescription(value.description);
    if (!description.ok) return description;
    data.description = description.data ?? null;
  }
  if (Object.hasOwn(value, "durationMinutes")) {
    const duration = parseDuration(value.durationMinutes);
    if (!duration.ok) return duration;
    data.durationMinutes = duration.data;
  }
  if (data.description === undefined && data.durationMinutes === undefined) {
    return { ok: false, error: "Trimite cel puțin un câmp care trebuie actualizat." } as const;
  }
  return { ok: true, data } as const;
}
