import type {
  StudentCalendarEvent,
  StudentCalendarPrototypeCatalog,
  StudentCalendarRecurrence,
  StudentCalendarWeekday,
} from "@/lib/student-calendar/student-calendar-types";
import { NON_RECURRING_RULE } from "@/lib/student-calendar/student-calendar-types";

export const STUDENT_CALENDAR_PROTOTYPE_CATALOG: StudentCalendarPrototypeCatalog = {
  treatments: [
    { id: "prototype-treatment-hygiene", name: "Igienizare", durationMinutes: 45 },
    {
      id: "prototype-treatment-gingival",
      name: "Afecțiuni gingivale",
      durationMinutes: 60,
    },
    {
      id: "prototype-treatment-restorative",
      name: "Tratament restaurativ",
      durationMinutes: 90,
    },
  ],
  locations: [
    { id: "prototype-location-clinic", name: "Clinica universitară centrală" },
    { id: "prototype-location-center", name: "Centrul clinic Mărăști" },
  ],
  supervisors: [
    { id: "prototype-supervisor-one", name: "Prof. univ. dr. Adriana Ionescu" },
    { id: "prototype-supervisor-two", name: "Dr. Bogdan Marinescu" },
    { id: "prototype-supervisor-three", name: "Carmen Dumitrescu" },
  ],
};

function startOfWeekMonday(referenceDate: Date) {
  const result = new Date(referenceDate);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function atWeekOffset(
  weekStart: Date,
  dayOffset: number,
  hour: number,
  minute: number,
  weekOffset = 0,
) {
  const result = new Date(weekStart);
  result.setDate(result.getDate() + dayOffset + weekOffset * 7);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function weekdayForDate(date: Date): StudentCalendarWeekday {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][date.getDay()] as StudentCalendarWeekday;
}

function recurringRule(
  frequency: "weekly" | "biweekly",
  date: Date,
  count: number,
): StudentCalendarRecurrence {
  return {
    frequency,
    weekdays: [weekdayForDate(date)],
    ends: { type: "afterCount", count },
  };
}

type PrototypeEventInput = Omit<
  StudentCalendarEvent,
  "originalStartsAt" | "startsAt" | "endsAt"
> & {
  originalStart: Date;
  start?: Date;
  durationMinutes: number;
};

function prototypeEvent(input: PrototypeEventInput): StudentCalendarEvent {
  const start = input.start ?? input.originalStart;

  return {
    id: input.id,
    seriesId: input.seriesId,
    originalStartsAt: input.originalStart.toISOString(),
    startsAt: start.toISOString(),
    endsAt: addMinutes(start, input.durationMinutes).toISOString(),
    treatmentLocationId: input.treatmentLocationId,
    treatmentName: input.treatmentName,
    locationName: input.locationName,
    supervisorName: input.supervisorName,
    recurrence: input.recurrence,
    appointmentStatus: input.appointmentStatus,
    isException: input.isException,
  };
}

/**
 * Date demonstrative generate în jurul săptămânii curente. Refresh-ul paginii
 * reconstruiește intenționat acest set și elimină toate editările locale.
 */
export function createMockStudentCalendarEvents(referenceDate = new Date()) {
  const weekStart = startOfWeekMonday(referenceDate);
  const weeklySeriesId = "prototype-series-weekly-hygiene";
  const biweeklySeriesId = "prototype-series-biweekly-gingival";
  const cancellableSeriesId = "prototype-series-weekly-restorative";
  const weeklyOriginal = atWeekOffset(weekStart, 0, 8, 0);
  const weeklyRule = recurringRule("weekly", weeklyOriginal, 4);
  const biweeklyOriginal = atWeekOffset(weekStart, 2, 13, 0);
  const biweeklyRule = recurringRule("biweekly", biweeklyOriginal, 3);
  const cancelledOriginal = atWeekOffset(weekStart, 3, 11, 0);
  const cancelledRule = recurringRule("weekly", cancelledOriginal, 3);

  const events: StudentCalendarEvent[] = [
    prototypeEvent({
      id: "prototype-single-availability",
      seriesId: null,
      originalStart: atWeekOffset(weekStart, 3, 17, 0),
      durationMinutes: 45,
      treatmentLocationId: "prototype-tl-hygiene-clinic-one",
      treatmentName: "Igienizare",
      locationName: "Clinica universitară centrală",
      supervisorName: "Prof. univ. dr. Adriana Ionescu",
      recurrence: NON_RECURRING_RULE,
      appointmentStatus: "available",
      isException: false,
    }),
    prototypeEvent({
      id: "prototype-pending-request",
      seriesId: null,
      originalStart: atWeekOffset(weekStart, 1, 14, 0),
      durationMinutes: 60,
      treatmentLocationId: "prototype-tl-gingival-center-two",
      treatmentName: "Afecțiuni gingivale",
      locationName: "Centrul clinic Mărăști",
      supervisorName: "Dr. Bogdan Marinescu",
      recurrence: NON_RECURRING_RULE,
      appointmentStatus: "pending",
      isException: false,
    }),
    prototypeEvent({
      id: "prototype-confirmed-appointment",
      seriesId: null,
      originalStart: atWeekOffset(weekStart, 4, 9, 30),
      durationMinutes: 90,
      treatmentLocationId: "prototype-tl-restorative-clinic-three",
      treatmentName: "Tratament restaurativ",
      locationName: "Clinica universitară centrală",
      supervisorName: "Carmen Dumitrescu",
      recurrence: NON_RECURRING_RULE,
      appointmentStatus: "confirmed",
      isException: false,
    }),
  ];

  for (let index = 0; index < 4; index += 1) {
    const originalStart = atWeekOffset(weekStart, 0, 8, 0, index);
    const movedOccurrence = index === 0;
    events.push(
      prototypeEvent({
        id: `prototype-weekly-${index + 1}`,
        seriesId: weeklySeriesId,
        originalStart,
        start: movedOccurrence
          ? atWeekOffset(weekStart, 1, 10, 30, index)
          : originalStart,
        durationMinutes: 45,
        treatmentLocationId: "prototype-tl-hygiene-clinic-one",
        treatmentName: "Igienizare",
        locationName: "Clinica universitară centrală",
        supervisorName: "Prof. univ. dr. Adriana Ionescu",
        recurrence: weeklyRule,
        appointmentStatus: "available",
        isException: movedOccurrence,
      }),
    );
  }

  for (let index = 0; index < 3; index += 1) {
    const originalStart = atWeekOffset(weekStart, 2, 13, 0, index * 2);
    events.push(
      prototypeEvent({
        id: `prototype-biweekly-${index + 1}`,
        seriesId: biweeklySeriesId,
        originalStart,
        durationMinutes: 60,
        treatmentLocationId: "prototype-tl-gingival-center-two",
        treatmentName: "Afecțiuni gingivale",
        locationName: "Centrul clinic Mărăști",
        supervisorName: "Dr. Bogdan Marinescu",
        recurrence: biweeklyRule,
        appointmentStatus: "available",
        isException: false,
      }),
    );
  }

  for (let index = 0; index < 3; index += 1) {
    const originalStart = atWeekOffset(weekStart, 3, 11, 0, index);
    events.push(
      prototypeEvent({
        id: `prototype-cancellable-${index + 1}`,
        seriesId: cancellableSeriesId,
        originalStart,
        durationMinutes: 90,
        treatmentLocationId: "prototype-tl-restorative-clinic-three",
        treatmentName: "Tratament restaurativ",
        locationName: "Clinica universitară centrală",
        supervisorName: "Carmen Dumitrescu",
        recurrence: cancelledRule,
        appointmentStatus: index === 0 ? "cancelled" : "available",
        isException: index === 0,
      }),
    );
  }

  return events.sort(
    (first, second) =>
      new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  );
}
