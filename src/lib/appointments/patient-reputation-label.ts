export function formatLateCancellationReputation(count: number) {
  return count === 1
    ? "o anulare târzie în ultimele 10 programări"
    : `${count} anulări târzii în ultimele 10 programări`;
}
