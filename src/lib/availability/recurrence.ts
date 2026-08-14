import { StudentAvailabilityWeekday } from "@/generated/prisma/enums";
import {
  addLocalDays,
  compareLocalDates,
  localDateForInstant,
  utcInstantForBucharestLocal,
} from "@/lib/availability/bucharest-time";

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
) {
  const occurrences: GeneratedOccurrence[] = [];
  const selectedWeekdays = new Set(rule.weekdays);
  const anchorMonday = mondayForLocalDate(rule.startsOn);
  let cursor = rule.startsOn;
  let sequenceNumber = 0;

  while (compareLocalDates(cursor, throughLocalDate) <= 0) {
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
      if (!startsAt) {
        throw new Error(`INVALID_LOCAL_TIME:${cursor}`);
      }
      sequenceNumber += 1;
      occurrences.push({
        sequenceNumber,
        localDate: cursor,
        startsAt,
        endsAt: new Date(startsAt.getTime() + rule.durationMinutes * 60_000),
      });
    }

    cursor = addLocalDays(cursor, 1);
  }

  return occurrences;
}

export function defaultMaterializationDate(now = new Date()) {
  return addLocalDays(localDateForInstant(now), 180);
}

