export function publicStudentBookingHref(
  studentSlug: string,
  treatmentSlug: string,
  citySlug: string,
  locationRouteKey?: string,
  profileSource?: "acasa",
) {
  const path = `/studenti/${encodeURIComponent(studentSlug)}/programare/${encodeURIComponent(treatmentSlug)}/${encodeURIComponent(citySlug)}`;
  const query = new URLSearchParams();
  if (locationRouteKey) query.set("locatie", locationRouteKey);
  if (profileSource === "acasa") query.set("sursa", "acasa");
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function publicStudentAvailabilityHref(
  studentSlug: string,
  treatmentSlug: string,
  citySlug: string,
  locationRouteKey?: string,
) {
  const query = new URLSearchParams({ tratament: treatmentSlug, oras: citySlug });
  if (locationRouteKey) query.set("locatie", locationRouteKey);
  return `/api/studenti/${encodeURIComponent(studentSlug)}/disponibilitati?${query}`;
}
