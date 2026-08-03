type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type CreateStudentSupervisorInput = {
  fullName: string;
  academicTitle: string | null;
};

export type UpdateStudentSupervisorInput = Partial<
  CreateStudentSupervisorInput & { isActive: boolean }
>;

const createFields = new Set(["fullName", "academicTitle"]);
const updateFields = new Set([
  "fullName",
  "academicTitle",
  "isActive",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function unexpectedField(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
) {
  return Object.keys(value).find((field) => !allowedFields.has(field));
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseFullName(value: unknown): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Numele profesorului trebuie să fie text." };
  }

  const fullName = normalizeSpaces(value);

  if (fullName.length < 2 || fullName.length > 120) {
    return {
      ok: false,
      error: "Numele profesorului trebuie să conțină între 2 și 120 de caractere.",
    };
  }

  return { ok: true, data: fullName };
}

function parseAcademicTitle(
  value: unknown,
): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return { ok: true, data: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: "Titlul academic trebuie să fie text." };
  }

  const academicTitle = normalizeSpaces(value);

  if (!academicTitle) {
    return { ok: true, data: null };
  }

  if (academicTitle.length < 2 || academicTitle.length > 80) {
    return {
      ok: false,
      error: "Titlul academic trebuie să conțină între 2 și 80 de caractere.",
    };
  }

  return { ok: true, data: academicTitle };
}

export function parseCreateStudentSupervisorInput(
  value: unknown,
): ParseResult<CreateStudentSupervisorInput> {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." };
  }

  const unexpected = unexpectedField(value, createFields);

  if (unexpected) {
    return { ok: false, error: `Câmpul „${unexpected}” nu este permis.` };
  }

  const fullName = parseFullName(value.fullName);
  const academicTitle = parseAcademicTitle(value.academicTitle);

  if (!fullName.ok) return fullName;
  if (!academicTitle.ok) return academicTitle;

  return {
    ok: true,
    data: { fullName: fullName.data, academicTitle: academicTitle.data },
  };
}

export function parseUpdateStudentSupervisorInput(
  value: unknown,
): ParseResult<UpdateStudentSupervisorInput> {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." };
  }

  const unexpected = unexpectedField(value, updateFields);

  if (unexpected) {
    return { ok: false, error: `Câmpul „${unexpected}” nu este permis.` };
  }

  const data: UpdateStudentSupervisorInput = {};

  if (hasOwn(value, "fullName")) {
    const fullName = parseFullName(value.fullName);
    if (!fullName.ok) return fullName;
    data.fullName = fullName.data;
  }

  if (hasOwn(value, "academicTitle")) {
    const academicTitle = parseAcademicTitle(value.academicTitle);
    if (!academicTitle.ok) return academicTitle;
    data.academicTitle = academicTitle.data;
  }

  if (hasOwn(value, "isActive")) {
    if (typeof value.isActive !== "boolean") {
      return {
        ok: false,
        error: "Starea profesorului trebuie să fie o valoare booleană.",
      };
    }
    data.isActive = value.isActive;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      error: "Trimite cel puțin un câmp care trebuie actualizat.",
    };
  }

  return { ok: true, data };
}
