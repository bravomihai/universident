import { ageOnDate, localDateToPrismaDate } from "@/lib/availability/bucharest-time";
import { isRecord } from "@/lib/appointments/appointment-input";

export function parsePatientProfileInput(value: unknown) {
  if (!isRecord(value) || typeof value.dateOfBirth !== "string") {
    return { ok: false, error: "Data nașterii este obligatorie." } as const;
  }

  const dateOfBirth = localDateToPrismaDate(value.dateOfBirth);
  if (!dateOfBirth) {
    return { ok: false, error: "Data nașterii nu este validă." } as const;
  }

  const age = ageOnDate(dateOfBirth, new Date());

  if (age < 18 || age > 130) {
    return {
      ok: false,
      error: "Rezervările Universident sunt disponibile momentan persoanelor de minimum 18 ani.",
    } as const;
  }

  let bio: string | null | undefined;
  if ("bio" in value) {
    if (value.bio !== null && typeof value.bio !== "string") {
      return { ok: false, error: "Descrierea trebuie să fie text." } as const;
    }
    const normalizedBio = typeof value.bio === "string" ? value.bio.trim() : "";
    if (normalizedBio.length > 1000) {
      return { ok: false, error: "Descrierea poate avea cel mult 1.000 de caractere." } as const;
    }
    bio = normalizedBio || null;
  }

  return { ok: true, data: { dateOfBirth, bio } } as const;
}
