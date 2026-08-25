import { StudentAvailabilityWeekday } from "@/generated/prisma/enums";
import {
  addLocalDays,
  compareLocalDates,
  utcInstantForBucharestLocal,
} from "@/lib/availability/bucharest-time";
import {
  MAX_GENERATED_OCCURRENCES_PER_OPERATION,
  MAX_LOCAL_DATES_PROCESSED_PER_OPERATION,
} from "@/lib/availability/limits";

export type AvailabilityRule = {
  startsOn: string;
  startMinuteOfDay: number;
  weekdays: StudentAvailabilityWeekday[];
  intervalWeeks: 1 | 2;
  durationMinutes: number;
  endMode: "NEVER" | "UNTIL" | "COUNT";
  endsOn: string | null;
  occurrenceCount: number | null;
};

export type GeneratedOccurrence = {
  sequenceNumber: number;
  localDate: string;
  startsAt: Date;
  endsAt: Date;
};

export class OccurrenceGenerationLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OccurrenceGenerationLimitError";
  }
}

type GenerateOccurrenceOptions = {
  fromLocalDate?: string;
  initialSequenceNumber?: number;
  maxOccurrences?: number;
  maxProcessedDates?: number;
  minimumElapsedDurationMinutes?: number;
};

const weekdayByJsDay: StudentAvailabilityWeekday[] = [
  StudentAvailabilityWeekday.SUNDAY,
  StudentAvailabilityWeekday.MONDAY,
  StudentAvailabilityWeekday.TUESDAY,
  StudentAvailabilityWeekday.WEDNESDAY,
  StudentAvailabilityWeekday.THURSDAY,
  StudentAvailabilityWeekday.FRIDAY,
  StudentAvailabilityWeekday.SATURDAY,
];

function weekdayForLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return weekdayByJsDay[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function mondayForLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsDay = date.getUTCDay();
  return addLocalDays(value, -(jsDay === 0 ? 6 : jsDay - 1));
}

function daysBetween(first: string, second: string) {
  const firstParts = first.split("-").map(Number);
  const secondParts = second.split("-").map(Number);
  return Math.round(
    (Date.UTC(secondParts[0], secondParts[1] - 1, secondParts[2]) -
      Date.UTC(firstParts[0], firstParts[1] - 1, firstParts[2])) /
      86_400_000,
  );
}

export function generateOccurrences(
  rule: AvailabilityRule,
  throughLocalDate: string,
  options: GenerateOccurrenceOptions = {},
) {
  const occurrences: GeneratedOccurrence[] = [];
  const selectedWeekdays = new Set(rule.weekdays);
  const anchorMonday = mondayForLocalDate(rule.startsOn);
  let cursor = options.fromLocalDate && compareLocalDates(options.fromLocalDate, rule.startsOn) > 0
    ? options.fromLocalDate
    : rule.startsOn;
  let sequenceNumber = options.initialSequenceNumber ?? 0;
  let processedDates = 0;
  const maxOccurrences = options.maxOccurrences ?? MAX_GENERATED_OCCURRENCES_PER_OPERATION;
  const maxProcessedDates = options.maxProcessedDates ?? MAX_LOCAL_DATES_PROCESSED_PER_OPERATION;

  if (rule.startMinuteOfDay + rule.durationMinutes >= 1440) {
    throw new OccurrenceGenerationLimitError("Regula recurentă depășește limita zilei locale.");
  }

  while (compareLocalDates(cursor, throughLocalDate) <= 0) {
    processedDates += 1;
    if (processedDates > maxProcessedDates) {
      throw new OccurrenceGenerationLimitError("Regula recurentă procesează prea multe date într-o singură operație.");
    }
    if (rule.endMode === "UNTIL" && rule.endsOn && compareLocalDates(cursor, rule.endsOn) > 0) {
      break;
    }
    if (
      rule.endMode === "COUNT" &&
      rule.occurrenceCount !== null &&
      sequenceNumber >= rule.occurrenceCount
    ) {
      break;
    }

    const cursorMonday = mondayForLocalDate(cursor);
    const weekDistance = daysBetween(anchorMonday, cursorMonday) / 7;
    if (
      weekDistance % rule.intervalWeeks === 0 &&
      selectedWeekdays.has(weekdayForLocalDate(cursor))
    ) {
      const startsAt = utcInstantForBucharestLocal(cursor, rule.startMinuteOfDay);
      const endsAt = utcInstantForBucharestLocal(
        cursor,
        rule.startMinuteOfDay + rule.durationMinutes,
      );
      // The deterministic DST policy omits a local gap. Ambiguous local times
      // are resolved by utcInstantForBucharestLocal to the earlier instant.
      if (
        startsAt &&
        endsAt &&
        endsAt > startsAt &&
        endsAt.getTime() - startsAt.getTime() >=
          (options.minimumElapsedDurationMinutes ?? 0) * 60_000
      ) {
        if (occurrences.length >= maxOccurrences) {
          throw new OccurrenceGenerationLimitError("Regula recurentă generează prea multe apariții într-o singură operație.");
        }
        sequenceNumber += 1;
        occurrences.push({ sequenceNumber, localDate: cursor, startsAt, endsAt });
      }
    }

    cursor = addLocalDays(cursor, 1);
  }

  return occurrences;
}
