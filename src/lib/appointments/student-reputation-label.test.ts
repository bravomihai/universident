import assert from "node:assert/strict";
import test from "node:test";

import { formatStudentCancellationReputation } from "@/lib/appointments/student-reputation-label";

test("student cancellation reputation uses correct Romanian singular and plural", () => {
  assert.equal(
    formatStudentCancellationReputation(0),
    "0 anulări în ultimele 10 programări confirmate",
  );
  assert.equal(
    formatStudentCancellationReputation(1),
    "o anulare în ultimele 10 programări confirmate",
  );
  assert.equal(
    formatStudentCancellationReputation(2),
    "2 anulări în ultimele 10 programări confirmate",
  );
});
