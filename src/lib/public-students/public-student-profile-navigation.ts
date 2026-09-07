export function publicStudentProfileHref(
  studentSlug: string,
  {
    source,
    treatmentSlug,
    citySlug,
    section,
  }: {
    source?: string | string[];
    treatmentSlug?: string;
    citySlug?: string;
    section?: "tratamente" | "recenzii";
  } = {},
) {
  const query = new URLSearchParams();
  if (treatmentSlug) query.set("tratament", treatmentSlug);
  if (citySlug) query.set("oras", citySlug);
  if (source === "acasa") query.set("sursa", "acasa");
  const search = query.toString();
  return `/studenti/${encodeURIComponent(studentSlug)}${search ? `?${search}` : ""}${section ? `#${section}` : ""}`;
}

export function publicStudentProfileFromHomeHref(studentSlug: string) {
  return publicStudentProfileHref(studentSlug, { source: "acasa" });
}

export function publicStudentProfileBackLink(
  source: string | string[] | undefined,
  search?: { treatmentSlug: string; citySlug: string },
) {
  if (source === "acasa") {
    return { href: "/", label: "Înapoi la pagina principală" };
  }
  if (search) {
    return {
      href: `/studenti?${new URLSearchParams({ tratament: search.treatmentSlug, oras: search.citySlug })}`,
      label: "Înapoi la rezultate",
    };
  }
  return { href: "/studenti", label: "Înapoi la căutare" };
}
