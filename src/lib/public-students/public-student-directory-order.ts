export const studentDirectorySortOptions = {
  recent: "Actualizate recent",
  rating: "Cel mai bine evaluați",
  completed: "Cele mai multe programări finalizate",
} as const;

export type StudentDirectorySort = keyof typeof studentDirectorySortOptions;

export function parseStudentDirectorySort(value: unknown): StudentDirectorySort {
  return value === "rating" || value === "completed" ? value : "recent";
}

export function publicStudentDirectoryHref(page = 1, sort: StudentDirectorySort = "recent") {
  const params = new URLSearchParams();
  if (sort !== "recent") params.set("sortare", sort);
  if (page > 1) params.set("pagina", String(page));
  return params.size > 0 ? `/studenti?${params.toString()}` : "/studenti";
}

function quantityLabel(count: number, singular: string, plural: string) {
  if (count === 1) return "1 " + singular;
  const remainder = count % 100;
  const separator = remainder >= 20 || (count >= 100 && remainder === 0) ? " de " : " ";
  return count + separator + plural;
}

export function completedAppointmentCountLabel(count: number) {
  return quantityLabel(count, "programare finalizată", "programări finalizate");
}

export function publicStudentCountLabel(count: number, results = false) {
  return results
    ? quantityLabel(count, "student găsit", "studenți găsiți")
    : quantityLabel(count, "student", "studenți");
}
