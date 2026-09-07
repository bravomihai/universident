import type { PublicStudentLocationDto } from "@/lib/public-students/public-student-service";

export function publicStudentLocationKey(
  location: Pick<PublicStudentLocationDto, "routeKey" | "supervisor">,
) {
  // Match the location–supervisor pairs deduplicated by the public profile query.
  return JSON.stringify([location.routeKey, location.supervisor.fullName]);
}
