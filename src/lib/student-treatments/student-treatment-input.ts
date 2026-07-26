type ParseResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export type CreateStudentTreatmentInput = {
  treatmentId: string;
  description: string | null;
  durationMinutes: number;
  locationIds: string[];
  isActive: boolean;
};

export type UpdateStudentTreatmentData = {
  description?: string | null;
  durationMinutes?: number;
  locationIds?: string[];
  isActive?: boolean;
};

export type UpdateStudentTreatmentInput = {
  data: UpdateStudentTreatmentData;
  confirmDeactivate: boolean;
};

const createFields = new Set([
  "treatmentId",
  "description",
  "durationMinutes",
  "locationIds",
  "isActive",
]);

const updateFields = new Set([
  "description",
  "durationMinutes",
  "locationIds",
  "isActive",
  "confirmDeactivate",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function findUnexpectedField(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): string | null {
  return (
    Object.keys(value).find((field) => !allowedFields.has(field)) ??
    null
  );
}

function parseIdentifier(
  value: unknown,
  label: string,
): ParseResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${label} trebuie să fie text.`,
    };
  }

  const identifier = value.trim();

  if (identifier.length < 1 || identifier.length > 191) {
    return {
      ok: false,
      error: `${label} nu este valid.`,
    };
  }

  return {
    ok: true,
    data: identifier,
  };
}

function parseDescription(
  value: unknown,
): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return {
      ok: true,
      data: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Descrierea trebuie să fie text.",
    };
  }

  const description = value.trim();

  if (description.length > 1000) {
    return {
      ok: false,
      error: "Descrierea poate avea cel mult 1000 de caractere.",
    };
  }

  return {
    ok: true,
    data: description || null,
  };
}

function parseDuration(value: unknown): ParseResult<number> {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 5 ||
    value > 480
  ) {
    return {
      ok: false,
      error:
        "Durata trebuie să fie un număr întreg între 5 și 480 de minute.",
    };
  }

  return {
    ok: true,
    data: value,
  };
}

function parseBoolean(
  value: unknown,
  label: string,
): ParseResult<boolean> {
  if (typeof value !== "boolean") {
    return {
      ok: false,
      error: `${label} trebuie să fie o valoare booleană.`,
    };
  }

  return {
    ok: true,
    data: value,
  };
}

function parseLocationIds(value: unknown): ParseResult<string[]> {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: "Locațiile trebuie trimise ca listă.",
    };
  }

  const locationIds: string[] = [];

  for (const locationIdValue of value) {
    const locationId = parseIdentifier(
      locationIdValue,
      "Identificatorul locației",
    );

    if (!locationId.ok) {
      return locationId;
    }

    locationIds.push(locationId.data);
  }

  if (new Set(locationIds).size !== locationIds.length) {
    return {
      ok: false,
      error: "Lista locațiilor nu poate conține duplicate.",
    };
  }

  return {
    ok: true,
    data: locationIds,
  };
}

export function parseCreateStudentTreatmentInput(
  value: unknown,
): ParseResult<CreateStudentTreatmentInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Datele trimise nu sunt valide.",
    };
  }

  const unexpectedField = findUnexpectedField(value, createFields);

  if (unexpectedField) {
    return {
      ok: false,
      error: `Câmpul „${unexpectedField}” nu este permis.`,
    };
  }

  const treatmentId = parseIdentifier(
    value.treatmentId,
    "Identificatorul tratamentului",
  );

  if (!treatmentId.ok) {
    return treatmentId;
  }

  const description = parseDescription(value.description);

  if (!description.ok) {
    return description;
  }

  const durationMinutes = parseDuration(value.durationMinutes);

  if (!durationMinutes.ok) {
    return durationMinutes;
  }

  let locationIds: string[] = [];

  if (hasOwn(value, "locationIds")) {
    const parsedLocationIds = parseLocationIds(value.locationIds);

    if (!parsedLocationIds.ok) {
      return parsedLocationIds;
    }

    locationIds = parsedLocationIds.data;
  }

  let isActive = false;

  if (hasOwn(value, "isActive")) {
    const parsedIsActive = parseBoolean(
      value.isActive,
      "Starea tratamentului",
    );

    if (!parsedIsActive.ok) {
      return parsedIsActive;
    }

    isActive = parsedIsActive.data;
  }

  return {
    ok: true,
    data: {
      treatmentId: treatmentId.data,
      description: description.data,
      durationMinutes: durationMinutes.data,
      locationIds,
      isActive,
    },
  };
}

export function parseUpdateStudentTreatmentInput(
  value: unknown,
): ParseResult<UpdateStudentTreatmentInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Datele trimise nu sunt valide.",
    };
  }

  const unexpectedField = findUnexpectedField(value, updateFields);

  if (unexpectedField) {
    return {
      ok: false,
      error: `Câmpul „${unexpectedField}” nu este permis.`,
    };
  }

  const data: UpdateStudentTreatmentData = {};
  let hasUpdate = false;

  if (hasOwn(value, "description")) {
    const description = parseDescription(value.description);

    if (!description.ok) {
      return description;
    }

    data.description = description.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "durationMinutes")) {
    const durationMinutes = parseDuration(value.durationMinutes);

    if (!durationMinutes.ok) {
      return durationMinutes;
    }

    data.durationMinutes = durationMinutes.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "locationIds")) {
    const locationIds = parseLocationIds(value.locationIds);

    if (!locationIds.ok) {
      return locationIds;
    }

    data.locationIds = locationIds.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "isActive")) {
    const isActive = parseBoolean(
      value.isActive,
      "Starea tratamentului",
    );

    if (!isActive.ok) {
      return isActive;
    }

    data.isActive = isActive.data;
    hasUpdate = true;
  }

  if (!hasUpdate) {
    return {
      ok: false,
      error: "Trimite cel puțin un câmp care trebuie actualizat.",
    };
  }

  let confirmDeactivate = false;

  if (hasOwn(value, "confirmDeactivate")) {
    const parsedConfirmation = parseBoolean(
      value.confirmDeactivate,
      "Confirmarea dezactivării tratamentului",
    );

    if (!parsedConfirmation.ok) {
      return parsedConfirmation;
    }

    confirmDeactivate = parsedConfirmation.data;
  }

  return {
    ok: true,
    data: {
      data,
      confirmDeactivate,
    },
  };
}
