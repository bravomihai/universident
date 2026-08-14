export function formatUnreadAppointmentNotifications(count: number) {
  if (count === 0) return "Nicio notificare nouă";
  if (count === 1) return "O notificare nouă";
  return count + " notificări noi";
}
