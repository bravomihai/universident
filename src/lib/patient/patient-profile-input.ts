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

  return { ok: true, data: { dateOfBirth } } as const;
}
