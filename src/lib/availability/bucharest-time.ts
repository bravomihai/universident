export const BUCHAREST_TIME_ZONE = "Europe/Bucharest";

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

const bucharestPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUCHAREST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function integerPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const value = parts.find((part) => part.type === type)?.value;
  return value ? Number(value) : Number.NaN;
}

export function parseLocalDate(value: string): LocalDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() + 1 !== parts.month ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

export function formatLocalDate(parts: LocalDateParts) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
    2,
    "0",
  )}-${String(parts.day).padStart(2, "0")}`;
}

export function localDateToPrismaDate(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

export function prismaDateToLocalDate(value: Date) {
  return formatLocalDate({
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  });
}

export function addLocalDays(value: string, days: number) {
  const parsed = parseLocalDate(value);
  if (!parsed) throw new Error("Invalid local date");
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatLocalDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function compareLocalDates(first: string, second: string) {
  return first.localeCompare(second);
}

export function localDateForInstant(instant: Date) {
  const parts = bucharestPartsFormatter.formatToParts(instant);
  return formatLocalDate({
    year: integerPart(parts, "year"),
    month: integerPart(parts, "month"),
    day: integerPart(parts, "day"),
  });
}

export function bucharestPartsForInstant(instant: Date) {
  const parts = bucharestPartsFormatter.formatToParts(instant);
  return {
    year: integerPart(parts, "year"),
    month: integerPart(parts, "month"),
    day: integerPart(parts, "day"),
    hour: integerPart(parts, "hour"),
    minute: integerPart(parts, "minute"),
    second: integerPart(parts, "second"),
  };
}

export function minuteOfDayForBucharestInstant(instant: Date) {
  const parts = bucharestPartsForInstant(instant);
  return parts.hour * 60 + parts.minute;
}

export function utcInstantForBucharestLocal(
  localDate: string,
  minuteOfDay: number,
) {
  const parsed = parseLocalDate(localDate);
  if (!parsed || !Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) {
    return null;
  }

  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const desiredAsUtc = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    hour,
    minute,
    0,
    0,
  );
  const offsets = new Set<number>();
  for (let sampleHours = -36; sampleHours <= 36; sampleHours += 6) {
    const sample = desiredAsUtc + sampleHours * 60 * 60_000;
    const observed = bucharestPartsForInstant(new Date(sample));
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      0,
    );
    offsets.add(observedAsUtc - sample);
  }

  const candidates = [...offsets]
    .map((offset) => desiredAsUtc - offset)
    .filter((candidate) => {
      const roundTrip = bucharestPartsForInstant(new Date(candidate));
      return (
        roundTrip.year === parsed.year &&
        roundTrip.month === parsed.month &&
        roundTrip.day === parsed.day &&
        roundTrip.hour === hour &&
        roundTrip.minute === minute &&
        roundTrip.second === 0
      );
    })
    .sort((first, second) => first - second);

  // A DST gap has no candidate. During the autumn overlap there are two;
  // choosing the first instant keeps create, preview and materialization deterministic.
  return candidates.length > 0 ? new Date(candidates[0]) : null;
}

export function ageOnDate(dateOfBirth: Date, onDate: Date) {
  const birth = {
    year: dateOfBirth.getUTCFullYear(),
    month: dateOfBirth.getUTCMonth() + 1,
    day: dateOfBirth.getUTCDate(),
  };
  const local = parseLocalDate(localDateForInstant(onDate));
  if (!local) return 0;

  let age = local.year - birth.year;
  if (
    local.month < birth.month ||
    (local.month === birth.month && local.day < birth.day)
  ) {
    age -= 1;
  }
  return age;
}
