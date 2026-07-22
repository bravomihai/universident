import { randomBytes } from "node:crypto";

function normalizeSlugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function createStudentPublicSlug(name: string) {
  const normalizedName = normalizeSlugPart(name);
  const suffix = randomBytes(6).toString("hex");

  return `${normalizedName || "student"}-${suffix}`;
}
