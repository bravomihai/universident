export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseIdentifier(value: unknown, label = "Identificatorul") {
  if (typeof value !== "string") {
    return { ok: false, error: `${label} nu este valid.` } as const;
  }
  const identifier = value.trim();
  if (identifier.length < 1 || identifier.length > 191) {
    return { ok: false, error: `${label} nu este valid.` } as const;
  }
  return { ok: true, data: identifier } as const;
}

export function parseStatusReason(value: unknown): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Motivul este obligatoriu." };
  }
  const reason = value.trim();
  if (reason.length < 20 || reason.length > 500) {
    return {
      ok: false,
      error: "Motivul trebuie să aibă între 20 și 500 de caractere.",
    };
  }
  return { ok: true, data: reason };
}

export function parsePatientNote(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, data: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Mesajul pentru student trebuie să fie text." };
  }
  const note = value.trim();
  if (note.length > 1000) {
    return { ok: false, error: "Mesajul poate avea cel mult 1.000 de caractere." };
  }
  return { ok: true, data: note || null };
}

export function parseExpectedVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return { ok: false, error: "Versiunea datelor nu este validă." } as const;
  }
  return { ok: true, data: value } as const;
}

function parseReviewRating(value: unknown): ParseResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return { ok: false, error: "Alege un rating între 1 și 5 stele." };
  }
  return { ok: true, data: value };
}

function parseReviewComment(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, data: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Comentariul recenziei trebuie să fie text." };
  }
  const comment = value.trim();
  if (comment.length > 0 && (comment.length < 10 || comment.length > 1000)) {
    return {
      ok: false,
      error: "Comentariul trebuie să aibă între 10 și 1.000 de caractere sau să rămână gol.",
    };
  }
  return { ok: true, data: comment || null };
}

export function parseAppointmentReviewInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  const rating = parseReviewRating(value.rating);
  if (!rating.ok) return rating;
  const comment = parseReviewComment(value.comment);
  if (!comment.ok) return comment;
  return { ok: true, data: { rating: rating.data, comment: comment.data } } as const;
}

export function parseCreateAppointmentInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  const slotId = parseIdentifier(value.slotId, "Slotul selectat");
  if (!slotId.ok) return slotId;
  const patientNote = parsePatientNote(value.patientNote);
  if (!patientNote.ok) return patientNote;

  let dateOfBirth: string | null = null;
  if (value.dateOfBirth !== undefined && value.dateOfBirth !== null && value.dateOfBirth !== "") {
    if (typeof value.dateOfBirth !== "string") {
      return { ok: false, error: "Data nașterii nu este validă." } as const;
    }
    dateOfBirth = value.dateOfBirth;
  }
  return {
    ok: true,
    data: { slotId: slotId.data, patientNote: patientNote.data, dateOfBirth },
  } as const;
}

export function parseAppointmentActionInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  const allowedActions = new Set([
    "CONFIRM",
    "REJECT",
    "CANCEL",
    "COMPLETE",
    "NO_SHOW",
  ]);
  if (typeof value.action !== "string" || !allowedActions.has(value.action)) {
    return { ok: false, error: "Acțiunea nu este validă." } as const;
  }
  const expectedVersion = parseExpectedVersion(value.expectedVersion);
  if (!expectedVersion.ok) return expectedVersion;

  let reason: string | null = null;
  if (value.action === "REJECT" || value.action === "CANCEL") {
    const parsedReason = parseStatusReason(value.reason);
    if (!parsedReason.ok) return parsedReason;
    reason = parsedReason.data;
  }
  let rating: number | null = null;
  let comment: string | null = null;
  if (value.action === "COMPLETE" || value.action === "NO_SHOW") {
    const review = parseAppointmentReviewInput(value);
    if (!review.ok) return review;
    rating = review.data.rating;
    comment = review.data.comment;
  }
  return {
    ok: true,
    data: {
      action: value.action as "CONFIRM" | "REJECT" | "CANCEL" | "COMPLETE" | "NO_SHOW",
      expectedVersion: expectedVersion.data,
      reason,
      rating,
      comment,
    },
  } as const;
}
