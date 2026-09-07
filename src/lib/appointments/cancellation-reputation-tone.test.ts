import assert from "node:assert/strict";
import test from "node:test";

import { getCancellationReputationTone } from "@/lib/appointments/cancellation-reputation-tone";

test("zero cancellations use the green label", () => {
  assert.equal(getCancellationReputationTone(0), "green");
});

test("one or two cancellations use the yellow label", () => {
  for (const count of [1, 2]) {
    assert.equal(getCancellationReputationTone(count), "yellow");
  }
});

test("three through five cancellations use the orange label", () => {
  for (const count of [3, 4, 5]) {
    assert.equal(getCancellationReputationTone(count), "orange");
  }
});

test("six through ten cancellations use the red label", () => {
  for (const count of [6, 7, 8, 9, 10]) {
    assert.equal(getCancellationReputationTone(count), "red");
  }
});
