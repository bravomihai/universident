import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKING_RATE_LIMIT_MAX_REQUESTS,
  BOOKING_RATE_LIMIT_WINDOW_MS,
  BookingUserRateLimiter,
} from "@/lib/appointments/booking-rate-limit";

test("rate limits booking attempts per authenticated user", () => {
  const limiter = new BookingUserRateLimiter();
  const now = 1_000_000;
  for (let index = 0; index < BOOKING_RATE_LIMIT_MAX_REQUESTS; index += 1) {
    assert.equal(limiter.consume("patient-1", now + index).allowed, true);
  }
  assert.equal(limiter.consume("patient-1", now + 100).allowed, false);
  assert.equal(limiter.consume("patient-2", now + 100).allowed, true);
  assert.equal(limiter.consume("patient-1", now + BOOKING_RATE_LIMIT_WINDOW_MS + 1).allowed, true);
});
