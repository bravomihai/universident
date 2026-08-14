import {
  StudentAvailabilityEndMode,
  StudentAvailabilityWeekday,
} from "@/generated/prisma/enums";
import { parseLocalDate } from "@/lib/availability/bucharest-time";
import type { AvailabilityRule } from "@/lib/availability/recurrence";
import {
  isRecord,
  parseExpectedVersion,
  parseIdentifier,
  parseStatusReason,
} from "@/lib/appointments/appointment-input";

const weekdays = new Set(Object.values(StudentAvailabilityWeekday));

function parseIsoInstant(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false, error: "Data și ora nu sunt valide." } as const;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !value.includes("T")) {
    return { ok: false, error: "Data și ora nu sunt valide." } as const;
  }
  return { ok: true, data: date } as const;
}

function parseDuration(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 15 ||
    value > 720 ||
    value % 15 !== 0
  ) {
    return {
      ok: false,
      error: "Intervalul trebuie să aibă între 15 minute și 12 ore, în pași de 15 minute.",
    } as const;
  }
  return { ok: true, data: value } as const;
}

function parseOfferings(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Alege cel puțin un tratament oferit în acest interval." } as const;
  }
  if (value.length > 30) {
    return { ok: false, error: "Poți selecta cel mult 30 de tratamente într-un interval." } as const;
  }
  const offerings: Array<{ studentTreatmentId: string; supervisorId: string }> = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return { ok: false, error: "Configurația tratamentelor nu este validă." } as const;
    }
    const treatment = parseIdentifier(item.studentTreatmentId, "Tratamentul");
    if (!treatment.ok) return treatment;
    const supervisor = parseIdentifier(item.supervisorId, "Supervizorul");
    if (!supervisor.ok) return supervisor;
    offerings.push({ studentTreatmentId: treatment.data, supervisorId: supervisor.data });
  }
  if (new Set(offerings.map((item) => item.studentTreatmentId)).size !== offerings.length) {
    return { ok: false, error: "Un tratament poate apărea o singură dată în interval." } as const;
  }
  return { ok: true, data: offerings } as const;
}

function parseConfiguration(value: Record<string, unknown>) {
  const location = parseIdentifier(value.studentLocationId, "Locația");
  if (!location.ok) return location;
  const offerings = parseOfferings(value.offerings);
  if (!offerings.ok) return offerings;
  return {
    ok: true,
    data: { studentLocationId: location.data, offerings: offerings.data },
  } as const;
}

function parseRule(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Regula de repetare nu este validă." } as const;
  if (typeof value.startsOn !== "string" || !parseLocalDate(value.startsOn)) {
    return { ok: false, error: "Data de început nu este validă." } as const;
  }
  if (
    typeof value.startMinuteOfDay !== "number" ||
    !Number.isInteger(value.startMinuteOfDay) ||
    value.startMinuteOfDay < 0 ||
    value.startMinuteOfDay > 1439
  ) {
    return { ok: false, error: "Ora de început nu este validă." } as const;
  }
  const duration = parseDuration(value.durationMinutes);
  if (!duration.ok) return duration;
  if (value.startMinuteOfDay + duration.data > 1440) {
    return { ok: false, error: "Intervalul repetat trebuie să se încheie în aceeași zi." } as const;
  }
  if (!Array.isArray(value.weekdays) || value.weekdays.length < 1) {
    return { ok: false, error: "Alege cel puțin o zi a săptămânii." } as const;
  }
  const parsedWeekdays = value.weekdays.filter(
    (weekday): weekday is StudentAvailabilityWeekday =>
      typeof weekday === "string" && weekdays.has(weekday as StudentAvailabilityWeekday),
  );
  if (parsedWeekdays.length !== value.weekdays.length || new Set(parsedWeekdays).size !== parsedWeekdays.length) {
    return { ok: false, error: "Zilele săptămânii nu sunt valide." } as const;
  }
  if (value.intervalWeeks !== 1 && value.intervalWeeks !== 2) {
    return { ok: false, error: "Intervalul de repetare trebuie să fie una sau două săptămâni." } as const;
  }
  if (!Object.values(StudentAvailabilityEndMode).includes(value.endMode as StudentAvailabilityEndMode)) {
    return { ok: false, error: "Modul de terminare nu este valid." } as const;
  }

  const endMode = value.endMode as StudentAvailabilityEndMode;
  let endsOn: string | null = null;
  let occurrenceCount: number | null = null;
  if (endMode === StudentAvailabilityEndMode.UNTIL) {
    if (typeof value.endsOn !== "string" || !parseLocalDate(value.endsOn) || value.endsOn < value.startsOn) {
      return { ok: false, error: "Data de terminare nu este validă." } as const;
    }
    endsOn = value.endsOn;
  }
  if (endMode === StudentAvailabilityEndMode.COUNT) {
    if (
      typeof value.occurrenceCount !== "number" ||
      !Number.isInteger(value.occurrenceCount) ||
      value.occurrenceCount < 1 ||
      value.occurrenceCount > 1000
    ) {
      return { ok: false, error: "Numărul de apariții trebuie să fie între 1 și 1.000." } as const;
    }
    occurrenceCount = value.occurrenceCount;
  }
  return {
    ok: true,
    data: {
      startsOn: value.startsOn,
      startMinuteOfDay: value.startMinuteOfDay,
      weekdays: parsedWeekdays,
      intervalWeeks: value.intervalWeeks as 1 | 2,
      durationMinutes: duration.data,
      endMode,
      endsOn,
      occurrenceCount,
    },
  } as const;
}

export function parseCreateAvailabilityInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const configuration = parseConfiguration(value);
  if (!configuration.ok) return configuration;

  if (value.kind === "SINGLE") {
    const startsAt = parseIsoInstant(value.startsAt);
    if (!startsAt.ok) return startsAt;
    const endsAt = parseIsoInstant(value.endsAt);
    if (!endsAt.ok) return endsAt;
    const duration = parseDuration(Math.round((endsAt.data.getTime() - startsAt.data.getTime()) / 60_000));
    if (!duration.ok) return duration;
    return {
      ok: true,
      data: { kind: "SINGLE" as const, ...configuration.data, startsAt: startsAt.data, endsAt: endsAt.data },
    } as const;
  }

  if (value.kind === "RECURRING") {
    const rule = parseRule(value.rule);
    if (!rule.ok) return rule;
    return { ok: true, data: { kind: "RECURRING" as const, ...configuration.data, rule: rule.data } } as const;
  }
  return { ok: false, error: "Tipul disponibilității nu este valid." } as const;
}

export function parseUpdateAvailabilityInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  const scope = value.scope === undefined ? "OCCURRENCE" : value.scope;
  if (scope !== "OCCURRENCE" && scope !== "SERIES") {
    return { ok: false, error: "Modul de editare nu este valid." } as const;
  }
  const configuration = parseConfiguration(value);
  if (!configuration.ok) return configuration;
  const startsAt = parseIsoInstant(value.startsAt);
  if (!startsAt.ok) return startsAt;
  const endsAt = parseIsoInstant(value.endsAt);
  if (!endsAt.ok) return endsAt;
  const duration = parseDuration(Math.round((endsAt.data.getTime() - startsAt.data.getTime()) / 60_000));
  if (!duration.ok) return duration;
  const version = parseExpectedVersion(value.expectedVersion);
  if (!version.ok) return version;
  let expectedSeriesRevision: number | null = null;
  let rule: AvailabilityRule | null = null;
  if (scope === "SERIES") {
    if (
      typeof value.expectedSeriesRevision !== "number" ||
      !Number.isInteger(value.expectedSeriesRevision) ||
      value.expectedSeriesRevision < 1
    ) {
      return { ok: false, error: "Revizia seriei nu este validă." } as const;
    }
    expectedSeriesRevision = value.expectedSeriesRevision;
    const parsedRule = parseRule(value.rule);
    if (!parsedRule.ok) return parsedRule;
    rule = parsedRule.data;
  }
  let appointmentReason: string | null = null;
  if (value.appointmentReason !== undefined && value.appointmentReason !== null && value.appointmentReason !== "") {
    const reason = parseStatusReason(value.appointmentReason);
    if (!reason.ok) return reason;
    appointmentReason = reason.data;
  }
  return {
    ok: true,
    data: {
      ...configuration.data,
      scope,
      startsAt: startsAt.data,
      endsAt: endsAt.data,
      expectedVersion: version.data,
      expectedSeriesRevision,
      rule,
      appointmentReason,
    },
  } as const;
}

export function parseCancelAvailabilityInput(value: unknown) {
  if (!isRecord(value)) return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  if (value.scope !== "OCCURRENCE" && value.scope !== "SERIES") {
    return { ok: false, error: "Modul de anulare nu este valid." } as const;
  }
  const version = parseExpectedVersion(value.expectedVersion);
  if (!version.ok) return version;
  let expectedSeriesRevision: number | null = null;
  if (value.scope === "SERIES") {
    if (typeof value.expectedSeriesRevision !== "number" || !Number.isInteger(value.expectedSeriesRevision) || value.expectedSeriesRevision < 1) {
      return { ok: false, error: "Revizia seriei nu este validă." } as const;
    }
    expectedSeriesRevision = value.expectedSeriesRevision;
  }
  let appointmentReason: string | null = null;
  if (value.appointmentReason !== undefined && value.appointmentReason !== null && value.appointmentReason !== "") {
    const reason = parseStatusReason(value.appointmentReason);
    if (!reason.ok) return reason;
    appointmentReason = reason.data;
  }
  return {
    ok: true,
    data: { scope: value.scope, expectedVersion: version.data, expectedSeriesRevision, appointmentReason },
  } as const;
}
