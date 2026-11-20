export function treatmentSupervisionLabel(university: string) {
  const name = university.trim();
  const label = "Tratament supervizat de un cadru didactic";
  return name ? label + " " + name : label;
}
