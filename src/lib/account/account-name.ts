export function parseAccountName(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false, error: "Numele este obligatoriu." } as const;
  }

  const name = value.trim().replace(/\s+/g, " ");

  if (name.length < 2) {
    return {
      ok: false,
      error: "Numele trebuie să conțină cel puțin 2 caractere.",
    } as const;
  }

  if (name.length > 100) {
    return {
      ok: false,
      error: "Numele poate avea cel mult 100 de caractere.",
    } as const;
  }

  return { ok: true, data: name } as const;
}
