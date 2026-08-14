export function formatStudentCancellationReputation(count: number) {
  return count === 1
    ? "o anulare în ultimele 10 programări confirmate"
    : count + " anulări în ultimele 10 programări confirmate";
}
