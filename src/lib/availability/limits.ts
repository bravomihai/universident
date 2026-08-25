import {
  addLocalDays,
  compareLocalDates,
  localDateForInstant,
  parseLocalDate,
} from "@/lib/availability/bucharest-time";

export const MATERIALIZATION_HORIZON_DAYS = 180;
export const CALENDAR_MAX_PAST_DAYS = 31;
export const CALENDAR_MAX_FUTURE_DAYS = 181;
export const CALENDAR_MAX_RANGE_DAYS = 211;
export const MAX_GENERATED_OCCURRENCES_PER_OPERATION = 256;
export const MAX_LOCAL_DATES_PROCESSED_PER_OPERATION = 366;
export const MAX_EXISTING_SLOTS_PER_SERIES_WINDOW = 256;
export const MATERIALIZATION_BATCH_SIZE = 32;
export const MAX_SERIES_PER_MATERIALIZATION_OPERATION = 64;
export const MAX_ACTIVE_SERIES_PER_STUDENT = 64;
export const MAX_RESOURCE_ROOTS_PER_OPERATION = 384;

const DAY_IN_MILLISECONDS = 86_400_000;

export function rollingMaterializationThrough(now: Date) {
  return addLocalDays(localDateForInstant(now), MATERIALIZATION_HORIZON_DAYS);
}

export function boundedMaterializationThrough(requested: string, now: Date) {
  if (!parseLocalDate(requested)) return null;
  const horizon = rollingMaterializationThrough(now);
  return compareLocalDates(requested, horizon) > 0 ? horizon : requested;
}

export function validateStudentCalendarRange(from: Date, to: Date, now: Date) {
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > CALENDAR_MAX_RANGE_DAYS * DAY_IN_MILLISECONDS ||
    from.getTime() < now.getTime() - CALENDAR_MAX_PAST_DAYS * DAY_IN_MILLISECONDS ||
    from.getTime() > now.getTime() + CALENDAR_MAX_FUTURE_DAYS * DAY_IN_MILLISECONDS ||
    to.getTime() > now.getTime() + CALENDAR_MAX_FUTURE_DAYS * DAY_IN_MILLISECONDS
  ) {
    return {
      ok: false,
      error: "Intervalul calendarului trebuie să fie între ultimele 31 de zile și următoarele 181 de zile.",
    } as const;
  }
  return { ok: true } as const;
}
