import { isRecord, parseIdentifier } from "@/lib/appointments/appointment-input";

export type StudentLocationData = { cityId: string; name: string; address: string; details: string | null };
export type UpdateStudentLocationData = Partial<StudentLocationData>;

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    return { ok: false, error: `${label} trebuie să conțină între ${min} și ${max} de caractere.` } as const;
  }
  return { ok: true, data: value.trim() } as const;
}

function details(value: unknown) {
  if (value === undefined || value === null || value === "") return { ok: true, data: null } as const;
  if (typeof value !== "string" || value.trim().length > 1000) return { ok: false, error: "Detaliile pot avea cel mult 1.000 de caractere." } as const;
  return { ok: true, data: value.trim() || null } as const;
}

export function parseCreateStudentLocationInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const city = parseIdentifier(value.cityId, "Orașul"); if (!city.ok) return city;
  const name = text(value.name, "Numele locației", 2, 160); if (!name.ok) return name;
  const address = text(value.address, "Adresa", 5, 240); if (!address.ok) return address;
  const parsedDetails = details(value.details); if (!parsedDetails.ok) return parsedDetails;
  return { ok: true, data: { cityId: city.data, name: name.data, address: address.data, details: parsedDetails.data } } as const;
}

export function parseUpdateStudentLocationInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const data: UpdateStudentLocationData = {};
  if (Object.hasOwn(value, "cityId")) { const parsed = parseIdentifier(value.cityId, "Orașul"); if (!parsed.ok) return parsed; data.cityId = parsed.data; }
  if (Object.hasOwn(value, "name")) { const parsed = text(value.name, "Numele locației", 2, 160); if (!parsed.ok) return parsed; data.name = parsed.data; }
  if (Object.hasOwn(value, "address")) { const parsed = text(value.address, "Adresa", 5, 240); if (!parsed.ok) return parsed; data.address = parsed.data; }
  if (Object.hasOwn(value, "details")) { const parsed = details(value.details); if (!parsed.ok) return parsed; data.details = parsed.data; }
  if (Object.keys(data).length === 0) return { ok: false, error: "Trimite cel puțin un câmp care trebuie actualizat." } as const;
  return { ok: true, data } as const;
}

export function parseArchiveStudentLocationInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  return { ok: true, data: {} } as const;
}
