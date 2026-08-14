import { randomBytes } from "node:crypto";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function createAppointmentRouteSlug(treatmentName: string, startsAt: Date) {
  const date = startsAt.toISOString().slice(0, 10);
  const suffix = randomBytes(4).toString("hex");
  return `${slugify(treatmentName) || "programare"}-${date}-${suffix}`;
}

export function createPatientProfileSlug(name: string) {
  return `${slugify(name) || "pacient"}-${randomBytes(4).toString("hex")}`;
}

