export const BOOKING_GRID_MINUTES = 15;

type Interval = { startsAt: Date; endsAt: Date };

export type AvailabilityBlockForBooking = Interval & {
  id: string;
  offeringId: string;
  treatmentDurationMinutes: number;
  offeredDurationsMinutes: number[];
  occupied: Interval[];
};

export type GeneratedBookingSlot = Interval & {
  availabilitySlotId: string;
  offeringId: string;
  optimized: boolean;
};

function mergeOccupied(block: Interval, occupied: Interval[]) {
  const clipped = occupied
    .map((item) => ({
      startsAt: new Date(Math.max(block.startsAt.getTime(), item.startsAt.getTime())),
      endsAt: new Date(Math.min(block.endsAt.getTime(), item.endsAt.getTime())),
    }))
    .filter((item) => item.endsAt > item.startsAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const merged: Interval[] = [];
  for (const item of clipped) {
    const previous = merged.at(-1);
    if (!previous || item.startsAt > previous.endsAt) {
      merged.push(item);
    } else if (item.endsAt > previous.endsAt) {
      previous.endsAt = item.endsAt;
    }
  }
  return merged;
}

function freeIntervals(block: Interval, occupied: Interval[]) {
  const result: Interval[] = [];
  let cursor = block.startsAt;
  for (const item of mergeOccupied(block, occupied)) {
    if (item.startsAt > cursor) result.push({ startsAt: cursor, endsAt: item.startsAt });
    if (item.endsAt > cursor) cursor = item.endsAt;
  }
  if (cursor < block.endsAt) result.push({ startsAt: cursor, endsAt: block.endsAt });
  return result;
}

function canPackExactly(totalMinutes: number, durations: number[]) {
  if (totalMinutes === 0) return true;
  if (totalMinutes < 0 || totalMinutes % BOOKING_GRID_MINUTES !== 0) return false;
  const normalized = [...new Set(durations)]
    .filter((duration) => duration >= BOOKING_GRID_MINUTES && duration % BOOKING_GRID_MINUTES === 0)
    .map((duration) => duration / BOOKING_GRID_MINUTES);
  const target = totalMinutes / BOOKING_GRID_MINUTES;
  const reachable = Array<boolean>(target + 1).fill(false);
  reachable[0] = true;
  for (let value = 1; value <= target; value += 1) {
    reachable[value] = normalized.some((duration) => value >= duration && reachable[value - duration]);
  }
  return reachable[target];
}

function minutesBetween(first: Date, second: Date) {
  return Math.round((second.getTime() - first.getTime()) / 60_000);
}

export function generateSmartBookingSlots(
  blocks: AvailabilityBlockForBooking[],
  now = new Date(),
): GeneratedBookingSlot[] {
  const candidates: GeneratedBookingSlot[] = [];
  for (const block of blocks) {
    const durationMs = block.treatmentDurationMinutes * 60_000;
    for (const free of freeIntervals(block, block.occupied)) {
      const firstStart = new Date(
        Math.max(
          free.startsAt.getTime(),
          Math.ceil(now.getTime() / (BOOKING_GRID_MINUTES * 60_000)) * BOOKING_GRID_MINUTES * 60_000,
        ),
      );
      const usableStart = firstStart > free.startsAt ? firstStart : free.startsAt;
      const total = minutesBetween(usableStart, free.endsAt);
      const maxCount = Math.floor(total / block.treatmentDurationMinutes);
      let layout: { count: number; before: number } | null = null;
      for (let count = maxCount; count >= 1 && !layout; count -= 1) {
        const remaining = total - count * block.treatmentDurationMinutes;
        for (let before = 0; before <= remaining; before += BOOKING_GRID_MINUTES) {
          const after = remaining - before;
          if (
            canPackExactly(before, block.offeredDurationsMinutes) &&
            canPackExactly(after, block.offeredDurationsMinutes)
          ) {
            layout = { count, before };
            break;
          }
        }
      }
      if (layout) {
        const layoutStart = usableStart.getTime() + layout.before * 60_000;
        for (let index = 0; index < layout.count; index += 1) {
          const startsAt = new Date(layoutStart + index * durationMs);
          candidates.push({
            availabilitySlotId: block.id,
            offeringId: block.offeringId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + durationMs),
            optimized: true,
          });
        }
        continue;
      }
      for (let startMs = usableStart.getTime(); startMs + durationMs <= free.endsAt.getTime(); startMs += BOOKING_GRID_MINUTES * 60_000) {
        candidates.push({
          availabilitySlotId: block.id,
          offeringId: block.offeringId,
          startsAt: new Date(startMs),
          endsAt: new Date(startMs + durationMs),
          optimized: false,
        });
      }
    }
  }
  return candidates.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
