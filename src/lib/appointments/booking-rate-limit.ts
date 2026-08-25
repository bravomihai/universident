export const BOOKING_RATE_LIMIT_MAX_REQUESTS = 10;
export const BOOKING_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const MAX_TRACKED_USERS = 10_000;

export class BookingUserRateLimiter {
  private readonly requests = new Map<string, number[]>();

  consume(userId: string, now = Date.now()) {
    const cutoff = now - BOOKING_RATE_LIMIT_WINDOW_MS;
    const recent = (this.requests.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= BOOKING_RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + BOOKING_RATE_LIMIT_WINDOW_MS - now) / 1000));
      this.requests.set(userId, recent);
      return { allowed: false, retryAfterSeconds } as const;
    }
    recent.push(now);
    this.requests.delete(userId);
    this.requests.set(userId, recent);
    if (this.requests.size > MAX_TRACKED_USERS) {
      const oldest = this.requests.keys().next().value;
      if (typeof oldest === "string") this.requests.delete(oldest);
    }
    return { allowed: true, retryAfterSeconds: 0 } as const;
  }
}

const globalForBookingRateLimit = globalThis as unknown as {
  bookingUserRateLimiter?: BookingUserRateLimiter;
};

export const bookingUserRateLimiter =
  globalForBookingRateLimit.bookingUserRateLimiter ?? new BookingUserRateLimiter();

if (process.env.NODE_ENV !== "production") {
  globalForBookingRateLimit.bookingUserRateLimiter = bookingUserRateLimiter;
}
