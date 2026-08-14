export const appointmentStatusLabels: Record<string, string> = {
  PENDING: "Cerere în așteptare",
  CONFIRMED: "Confirmată",
  REJECTED: "Respinsă",
  SUPERSEDED: "Înlocuită",
  EXPIRED: "Expirată",
  CANCELLED_BY_PATIENT: "Anulată de pacient",
  CANCELLED_BY_STUDENT: "Anulată de student",
  COMPLETED: "Finalizată",
  NO_SHOW: "Neprezentare",
};

export function formatAppointmentInterval(startsAt: string | Date, endsAt: string | Date) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time.format(start)}–${time.format(end)}`;
}
