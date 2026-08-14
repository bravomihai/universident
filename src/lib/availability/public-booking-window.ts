export const PUBLIC_BOOKING_WINDOW_DAYS = 60;

const DAY_IN_MILLISECONDS = 86_400_000;

export function publicBookingWindowEnd(now: Date) {
  return new Date(
    now.getTime() + PUBLIC_BOOKING_WINDOW_DAYS * DAY_IN_MILLISECONDS,
  );
}
