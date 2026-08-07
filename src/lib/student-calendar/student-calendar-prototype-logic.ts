import type {
  StudentCalendarEvent,
  StudentCalendarRecurrence,
  StudentCalendarRecurrenceEnd,
  StudentCalendarRecurrenceFrequency,
  StudentCalendarWeekday,
} from "@/lib/student-calendar/student-calendar-types";
import { STUDENT_CALENDAR_WEEKDAYS } from "@/lib/student-calendar/student-calendar-types";

export type StudentCalendarRecurrenceDraft = {
  frequency: StudentCalendarRecurrenceFrequency;
  weekdays: StudentCalendarWeekday[];
  endType: StudentCalendarRecurrenceEnd["type"];
  endDate: string;
  occurrenceCount: number;
};

const weekdayOrder = new Map(
  STUDENT_CALENDAR_WEEKDAYS.map((weekday, index) => [weekday.id, index]),
);

const longDateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("ro-RO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ro-RO", {
  hour: "2-digit",
  minute: "2-digit",
});

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function parseLocalDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function weekdayForDate(date: Date): StudentCalendarWeekday {
  const day = date.getDay();
  return (
    STUDENT_CALENDAR_WEEKDAYS.find((weekday) => weekday.jsDay === day)?.id ??
    "monday"
  );
}

function startOfWeekMonday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function setTime(date: Date, source: Date) {
  const result = new Date(date);
  result.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return result;
}

function recurrenceEndFromDraft(
  draft: StudentCalendarRecurrenceDraft,
): StudentCalendarRecurrenceEnd {
  if (draft.endType === "onDate") {
    return { type: "onDate", date: draft.endDate };
  }

  if (draft.endType === "afterCount") {
    return { type: "afterCount", count: draft.occurrenceCount };
  }

  return { type: "never" };
}

export function recurrenceFromDraft(
  draft: StudentCalendarRecurrenceDraft,
): StudentCalendarRecurrence {
  if (draft.frequency === "none") {
    return { frequency: "none", weekdays: [], ends: { type: "never" } };
  }

  return {
    frequency: draft.frequency,
    weekdays: [...draft.weekdays].sort(
      (first, second) =>
        (weekdayOrder.get(first) ?? 0) - (weekdayOrder.get(second) ?? 0),
    ),
    ends: recurrenceEndFromDraft(draft),
  };
}

/**
 * O regulă fără termen este materializată pentru 16 apariții în prototip.
 * API-ul real va înlocui această limită de previzualizare.
 */
export function generatePrototypeOccurrenceStarts(
  startsAt: Date,
  recurrence: StudentCalendarRecurrence,
) {
  if (recurrence.frequency === "none") return [startsAt];

  const selectedWeekdays = STUDENT_CALENDAR_WEEKDAYS.filter((weekday) =>
    recurrence.weekdays.includes(weekday.id),
  );
  if (selectedWeekdays.length === 0) return [];

  const weekInterval = recurrence.frequency === "biweekly" ? 2 : 1;
  const firstWeek = startOfWeekMonday(startsAt);
  const maximumOccurrences =
    recurrence.ends.type === "afterCount" ? recurrence.ends.count : 16;
  const endDate =
    recurrence.ends.type === "onDate"
      ? new Date(`${recurrence.ends.date}T23:59:59`)
      : null;
  const occurrences: Date[] = [];

  for (
    let weekOffset = 0;
    weekOffset <= 104 && occurrences.length < maximumOccurrences;
    weekOffset += weekInterval
  ) {
    for (const weekday of selectedWeekdays) {
      const occurrence = new Date(firstWeek);
      const dayOffset = weekday.jsDay === 0 ? 6 : weekday.jsDay - 1;
      occurrence.setDate(occurrence.getDate() + weekOffset * 7 + dayOffset);
      const timedOccurrence = setTime(occurrence, startsAt);

      if (timedOccurrence < startsAt) continue;
      if (endDate && timedOccurrence > endDate) return occurrences;

      occurrences.push(timedOccurrence);
      if (occurrences.length >= maximumOccurrences) break;
    }
  }

  return occurrences;
}

function joinHumanList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} și ${values.at(-1)}`;
}

export function humanRecurrenceDescription(
  recurrence: StudentCalendarRecurrence,
  startsAt: Date,
) {
  if (recurrence.frequency === "none") {
    return `Nu se repetă. Slot pe ${longDateFormatter.format(
      startsAt,
    )}, la ${timeFormatter.format(startsAt)}.`;
  }

  const dayLabels = recurrence.weekdays
    .map(
      (weekday) =>
        STUDENT_CALENDAR_WEEKDAYS.find((option) => option.id === weekday)
          ?.label.toLocaleLowerCase("ro-RO") ?? weekday,
    );
  const cadence =
    recurrence.frequency === "biweekly"
      ? "Se repetă la două săptămâni"
      : "Se repetă săptămânal";
  const ending =
    recurrence.ends.type === "onDate"
      ? `, până la ${longDateFormatter.format(
          new Date(`${recurrence.ends.date}T12:00:00`),
        )}`
      : recurrence.ends.type === "afterCount"
        ? `, după ${recurrence.ends.count} apariții`
        : ", fără dată de încheiere";

  return `${cadence}, ${joinHumanList(dayLabels)}, începând cu ${longDateFormatter.format(
    startsAt,
  )}, la ${timeFormatter.format(startsAt)}${ending}.`;
}

export function formatCalendarEventInterval(event: StudentCalendarEvent) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  return `${shortDateTimeFormatter.format(startsAt)}–${timeFormatter.format(
    endsAt,
  )}`;
}

export function calendarStatusLabel(
  status: StudentCalendarEvent["appointmentStatus"],
) {
  if (status === "pending") return "Cerere în așteptare";
  if (status === "confirmed") return "Programare confirmată";
  if (status === "cancelled") return "Apariție anulată";
  return "Disponibil";
}

export function isCalendarEventMovable(event: StudentCalendarEvent) {
  return event.appointmentStatus === "available";
}

function eventOccupiesTime(event: StudentCalendarEvent) {
  return event.appointmentStatus !== "cancelled";
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

export function findCalendarConflict(
  startsAt: Date,
  endsAt: Date,
  events: StudentCalendarEvent[],
  ignoredEventIds: Iterable<string> = [],
) {
  const ignored = new Set(ignoredEventIds);
  return events.find(
    (event) =>
      !ignored.has(event.id) &&
      eventOccupiesTime(event) &&
      intervalsOverlap(
        startsAt,
        endsAt,
        new Date(event.startsAt),
        new Date(event.endsAt),
      ),
  );
}

export function findChangedEventsConflict(
  events: StudentCalendarEvent[],
  changedEventIds: Set<string>,
) {
  for (const changedEvent of events) {
    if (!changedEventIds.has(changedEvent.id)) continue;

    const conflict = findCalendarConflict(
      new Date(changedEvent.startsAt),
      new Date(changedEvent.endsAt),
      events,
      [changedEvent.id],
    );
    if (conflict) return { changedEvent, conflict };
  }

  return null;
}

export function shiftCalendarEvent(
  event: StudentCalendarEvent,
  deltaMilliseconds: number,
  updateOriginalStart: boolean,
) {
  const shiftedStart = new Date(
    new Date(event.startsAt).getTime() + deltaMilliseconds,
  );
  const shiftedEnd = new Date(
    new Date(event.endsAt).getTime() + deltaMilliseconds,
  );
  const shiftedOriginal = new Date(
    new Date(event.originalStartsAt).getTime() + deltaMilliseconds,
  );

  return {
    ...event,
    startsAt: shiftedStart.toISOString(),
    endsAt: shiftedEnd.toISOString(),
    originalStartsAt: updateOriginalStart
      ? shiftedOriginal.toISOString()
      : event.originalStartsAt,
    isException: updateOriginalStart ? event.isException : true,
  };
}
