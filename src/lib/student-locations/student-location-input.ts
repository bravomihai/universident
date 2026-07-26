type ParseResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export type CreateStudentLocationInput = {
  cityId: string;
  name: string;
  address: string;
  details: string | null;
  isActive: boolean;
};

export type UpdateStudentLocationData = Partial<
  CreateStudentLocationInput
>;

export type UpdateStudentLocationInput = {
  data: UpdateStudentLocationData;
  confirmCascade: boolean;
};

export type ArchiveStudentLocationInput = {
  confirmCascade: boolean;
};

const createFields = new Set([
  "cityId",
  "name",
  "address",
  "details",
  "isActive",
]);

const updateFields = new Set([
  ...createFields,
  "confirmCascade",
]);

const archiveFields = new Set(["confirmCascade"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function rejectUnexpectedFields(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): string | null {
  const unexpectedField = Object.keys(value).find(
    (key) => !allowedFields.has(key),
  );

  return unexpectedField
    ? `Câmpul „${unexpectedField}” nu este permis.`
    : null;
}

function parseTrimmedString(
  value: unknown,
  label: string,
  minimumLength: number,
  maximumLength: number,
): ParseResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${label} trebuie să fie text.`,
    };
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.length < minimumLength ||
    trimmedValue.length > maximumLength
  ) {
    return {
      ok: false,
      error: `${label} trebuie să conțină între ${minimumLength} și ${maximumLength} de caractere.`,
    };
  }

  return {
    ok: true,
    data: trimmedValue,
  };
}

function parseDetails(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return {
      ok: true,
      data: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Detaliile trebuie să fie text.",
    };
  }

  const details = value.trim();

  if (details.length > 1000) {
    return {
      ok: false,
      error: "Detaliile pot avea cel mult 1000 de caractere.",
    };
  }

  return {
    ok: true,
    data: details || null,
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

export function parseCreateStudentLocationInput(
  value: unknown,
): ParseResult<CreateStudentLocationInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Datele trimise nu sunt valide.",
    };
  }

  const unexpectedField = rejectUnexpectedFields(value, createFields);

  if (unexpectedField) {
    return {
      ok: false,
      error: unexpectedField,
    };
  }

  const cityId = parseTrimmedString(
    value.cityId,
    "Identificatorul orașului",
    1,
    191,
  );

  if (!cityId.ok) {
    return cityId;
  }

  const name = parseTrimmedString(
    value.name,
    "Numele locației",
    2,
    120,
  );

  if (!name.ok) {
    return name;
  }

  const address = parseTrimmedString(
    value.address,
    "Adresa",
    5,
    240,
  );

  if (!address.ok) {
    return address;
  }

  const details = parseDetails(value.details);

  if (!details.ok) {
    return details;
  }

  let isActive = true;

  if (hasOwn(value, "isActive")) {
    const parsedIsActive = parseBoolean(
      value.isActive,
      "Starea locației",
    );

    if (!parsedIsActive.ok) {
      return parsedIsActive;
    }

    isActive = parsedIsActive.data;
  }

  return {
    ok: true,
    data: {
      cityId: cityId.data,
      name: name.data,
      address: address.data,
      details: details.data,
      isActive,
    },
  };
}

export function parseUpdateStudentLocationInput(
  value: unknown,
): ParseResult<UpdateStudentLocationInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Datele trimise nu sunt valide.",
    };
  }

  const unexpectedField = rejectUnexpectedFields(value, updateFields);

  if (unexpectedField) {
    return {
      ok: false,
      error: unexpectedField,
    };
  }

  const data: UpdateStudentLocationData = {};
  let hasUpdate = false;

  if (hasOwn(value, "cityId")) {
    const cityId = parseTrimmedString(
      value.cityId,
      "Identificatorul orașului",
      1,
      191,
    );

    if (!cityId.ok) {
      return cityId;
    }

    data.cityId = cityId.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "name")) {
    const name = parseTrimmedString(
      value.name,
      "Numele locației",
      2,
      120,
    );

    if (!name.ok) {
      return name;
    }

    data.name = name.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "address")) {
    const address = parseTrimmedString(
      value.address,
      "Adresa",
      5,
      240,
    );

    if (!address.ok) {
      return address;
    }

    data.address = address.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "details")) {
    const details = parseDetails(value.details);

    if (!details.ok) {
      return details;
    }

    data.details = details.data;
    hasUpdate = true;
  }

  if (hasOwn(value, "isActive")) {
    const isActive = parseBoolean(
      value.isActive,
      "Starea locației",
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

  let confirmCascade = false;

  if (hasOwn(value, "confirmCascade")) {
    const parsedConfirmation = parseBoolean(
      value.confirmCascade,
      "Confirmarea dezactivării tratamentelor",
    );

    if (!parsedConfirmation.ok) {
      return parsedConfirmation;
    }

    confirmCascade = parsedConfirmation.data;
  }

  return {
    ok: true,
    data: {
      data,
      confirmCascade,
    },
  };
}

export function parseArchiveStudentLocationInput(
  value: unknown,
): ParseResult<ArchiveStudentLocationInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Datele trimise nu sunt valide.",
    };
  }

  const unexpectedField = rejectUnexpectedFields(value, archiveFields);

  if (unexpectedField) {
    return {
      ok: false,
      error: unexpectedField,
    };
  }

  if (!hasOwn(value, "confirmCascade")) {
    return {
      ok: true,
      data: {
        confirmCascade: false,
      },
    };
  }

  const confirmCascade = parseBoolean(
    value.confirmCascade,
    "Confirmarea dezactivării tratamentelor",
  );

  if (!confirmCascade.ok) {
    return confirmCascade;
  }

  return {
    ok: true,
    data: {
      confirmCascade: confirmCascade.data,
    },
  };
}
