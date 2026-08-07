export type StudentCalendarWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type StudentCalendarRecurrenceFrequency =
  | "none"
  | "weekly"
  | "biweekly";

export type StudentCalendarRecurrenceEnd =
  | { type: "never" }
  | { type: "onDate"; date: string }
  | { type: "afterCount"; count: number };

export type StudentCalendarRecurrence = {
  frequency: StudentCalendarRecurrenceFrequency;
  weekdays: StudentCalendarWeekday[];
  ends: StudentCalendarRecurrenceEnd;
};

export type StudentCalendarAppointmentStatus =
  | "available"
  | "pending"
  | "confirmed"
  | "cancelled";

export type StudentCalendarEvent = {
  id: string;
  seriesId: string | null;
  originalStartsAt: string;
  startsAt: string;
  endsAt: string;
  treatmentLocationId: string;
  treatmentName: string;
  locationName: string;
  supervisorName: string;
  recurrence: StudentCalendarRecurrence;
  appointmentStatus: StudentCalendarAppointmentStatus;
  isException: boolean;
};

export type StudentCalendarTreatmentOption = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type StudentCalendarLocationOption = {
  id: string;
  name: string;
};

export type StudentCalendarSupervisorOption = {
  id: string;
  name: string;
};

export type StudentCalendarPrototypeCatalog = {
  treatments: StudentCalendarTreatmentOption[];
  locations: StudentCalendarLocationOption[];
  supervisors: StudentCalendarSupervisorOption[];
};

export type StudentCalendarMoveScope =
  | "occurrence"
  | "following"
  | "series";

export const STUDENT_CALENDAR_WEEKDAYS: Array<{
  id: StudentCalendarWeekday;
  label: string;
  shortLabel: string;
  jsDay: number;
}> = [
  { id: "monday", label: "Luni", shortLabel: "Lu", jsDay: 1 },
  { id: "tuesday", label: "Marți", shortLabel: "Ma", jsDay: 2 },
  { id: "wednesday", label: "Miercuri", shortLabel: "Mi", jsDay: 3 },
  { id: "thursday", label: "Joi", shortLabel: "Jo", jsDay: 4 },
  { id: "friday", label: "Vineri", shortLabel: "Vi", jsDay: 5 },
  { id: "saturday", label: "Sâmbătă", shortLabel: "Sâ", jsDay: 6 },
  { id: "sunday", label: "Duminică", shortLabel: "Du", jsDay: 0 },
];

export const NON_RECURRING_RULE: StudentCalendarRecurrence = {
  frequency: "none",
  weekdays: [],
  ends: { type: "never" },
};
