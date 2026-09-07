import { addLocalDays, utcInstantForBucharestLocal } from "../../src/lib/availability/bucharest-time";

type DemoTimeSlot = {
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  isCancelled?: boolean;
};
type OccupiedInterval = { startsAt: Date; endsAt: Date };

export function placeLocalDemoSlots<T extends DemoTimeSlot>(
  definitions: T[],
  today: string,
  occupied: OccupiedInterval[],
): T[] {
  const reserved = [...occupied];
  return definitions.map((definition) => {
    const direction = definition.dayOffset < 0 ? -1 : 1;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const dayOffset = definition.dayOffset + direction * attempt;
      const day = addLocalDays(today, dayOffset);
      const startsAt = utcInstantForBucharestLocal(day, definition.startMinute);
      const endsAt = utcInstantForBucharestLocal(day, definition.endMinute);
      if (!startsAt || !endsAt || endsAt <= startsAt) continue;
      const overlaps = !definition.isCancelled && reserved.some((interval) =>
        startsAt < interval.endsAt && endsAt > interval.startsAt,
      );
      if (overlaps) continue;
      if (!definition.isCancelled) reserved.push({ startsAt, endsAt });
      return { ...definition, dayOffset };
    }
    throw new Error("Nu există o zi liberă pentru un interval demo în limita de 90 de încercări.");
  });
}
