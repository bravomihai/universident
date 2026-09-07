export function getCancellationReputationTone(count: number) {
  if (count >= 6) return "red";
  if (count >= 3) return "orange";
  if (count >= 1) return "yellow";
  return "green";
}
