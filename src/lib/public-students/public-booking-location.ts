import { isStudentLocationRouteKey } from "@/lib/student-locations/student-location-route-key";

// undefined means all locations in the city; null means an invalid filter.
export function parsePublicBookingLocation(value: string | string[] | null | undefined) {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" && isStudentLocationRouteKey(value) ? value : null;
}

export function publicBookingLocationWhere(citySlug: string, locationRouteKey?: string) {
  return {
    deletedAt: null,
    city: { slug: citySlug, isActive: true },
    ...(locationRouteKey ? { routeKey: locationRouteKey } : {}),
  };
}
