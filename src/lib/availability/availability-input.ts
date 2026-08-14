import {
  StudentAvailabilityEndMode,
  StudentAvailabilityWeekday,
} from "@/generated/prisma/enums";
import { parseLocalDate } from "@/lib/availability/bucharest-time";
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

function parseRule(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Regula de repetare nu este validă." } as const;
  }

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
  if (!Array.isArray(value.weekdays) || value.weekdays.length < 1) {
    return { ok: false, error: "Alege cel puțin o zi a săptămânii." } as const;
  }
  const parsedWeekdays = value.weekdays.filter(
    (weekday): weekday is StudentAvailabilityWeekday =>
      typeof weekday === "string" && weekdays.has(weekday as StudentAvailabilityWeekday),
  );
  if (
    parsedWeekdays.length !== value.weekdays.length ||
    new Set(parsedWeekdays).size !== parsedWeekdays.length
  ) {
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
    if (
      typeof value.endsOn !== "string" ||
      !parseLocalDate(value.endsOn) ||
      value.endsOn < value.startsOn
    ) {
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
      endMode,
      endsOn,
      occurrenceCount,
    },
  } as const;
}

export function parseCreateAvailabilityInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  const association = parseIdentifier(
    value.studentTreatmentLocationId,
    "Asocierea selectată",
  );
  if (!association.ok) return association;

  if (value.kind === "SINGLE") {
    const startsAt = parseIsoInstant(value.startsAt);
    if (!startsAt.ok) return startsAt;
    return {
      ok: true,
      data: {
        kind: "SINGLE" as const,
        studentTreatmentLocationId: association.data,
        startsAt: startsAt.data,
      },
    } as const;
  }

  if (value.kind === "RECURRING") {
    const rule = parseRule(value.rule);
    if (!rule.ok) return rule;
    return {
      ok: true,
      data: {
        kind: "RECURRING" as const,
        studentTreatmentLocationId: association.data,
        rule: rule.data,
      },
    } as const;
  }

  return { ok: false, error: "Tipul disponibilității nu este valid." } as const;
}

export function parseMoveAvailabilityInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  if (value.scope !== "OCCURRENCE" && value.scope !== "FOLLOWING" && value.scope !== "SERIES") {
    return { ok: false, error: "Modul de aplicare nu este valid." } as const;
  }
  const startsAt = parseIsoInstant(value.startsAt);
  if (!startsAt.ok) return startsAt;
  const version = parseExpectedVersion(value.expectedVersion);
  if (!version.ok) return version;

  let expectedSeriesRevision: number | null = null;
  if (value.scope !== "OCCURRENCE") {
    if (
      typeof value.expectedSeriesRevision !== "number" ||
      !Number.isInteger(value.expectedSeriesRevision) ||
      value.expectedSeriesRevision < 1
    ) {
      return { ok: false, error: "Revizia seriei nu este validă." } as const;
    }
    expectedSeriesRevision = value.expectedSeriesRevision;
  }

  let appointmentReason: string | null = null;
  if (value.appointmentReason !== undefined && value.appointmentReason !== null) {
    const reason = parseStatusReason(value.appointmentReason);
    if (!reason.ok) return reason;
    appointmentReason = reason.data;
  }

  return {
    ok: true,
    data: {
      scope: value.scope,
      startsAt: startsAt.data,
      expectedVersion: version.data,
      expectedSeriesRevision,
      appointmentReason,
    },
  } as const;
}

export function parseCancelAvailabilityInput(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false, error: "Datele trimise nu sunt valide." } as const;
  }
  if (value.scope !== "OCCURRENCE" && value.scope !== "SERIES") {
    return { ok: false, error: "Modul de anulare nu este valid." } as const;
  }
  const version = parseExpectedVersion(value.expectedVersion);
  if (!version.ok) return version;
  let expectedSeriesRevision: number | null = null;
  if (value.scope === "SERIES") {
    if (
      typeof value.expectedSeriesRevision !== "number" ||
      !Number.isInteger(value.expectedSeriesRevision) ||
      value.expectedSeriesRevision < 1
    ) {
      return { ok: false, error: "Revizia seriei nu este validă." } as const;
    }
    expectedSeriesRevision = value.expectedSeriesRevision;
  }
  let appointmentReason: string | null = null;
  if (value.appointmentReason !== undefined && value.appointmentReason !== null) {
    const reason = parseStatusReason(value.appointmentReason);
    if (!reason.ok) return reason;
    appointmentReason = reason.data;
  }
  return {
    ok: true,
    data: {
      scope: value.scope,
      expectedVersion: version.data,
      expectedSeriesRevision,
      appointmentReason,
    },
  } as const;
}

