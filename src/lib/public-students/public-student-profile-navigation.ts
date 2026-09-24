export function publicStudentProfileHref(
  studentSlug: string,
  {
    treatmentSlug,
    citySlug,
    section,
  }: {
    treatmentSlug?: string;
    citySlug?: string;
    section?: "tratamente" | "recenzii";
  } = {},
) {
  const query = new URLSearchParams();
  if (treatmentSlug) query.set("tratament", treatmentSlug);
  if (citySlug) query.set("oras", citySlug);
  const search = query.toString();
  return `/studenti/${encodeURIComponent(studentSlug)}${search ? `?${search}` : ""}${section ? `#${section}` : ""}`;
}
