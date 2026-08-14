import assert from "node:assert/strict";
import test from "node:test";

import { parsePatientProfileInput } from "@/lib/patient/patient-profile-input";

test("patient bio is optional and omitted input stays unchanged", () => {
  const result = parsePatientProfileInput({ dateOfBirth: "1990-01-15" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.bio, undefined);
});

test("patient bio is trimmed and blank text becomes null", () => {
  const blank = parsePatientProfileInput({ dateOfBirth: "1990-01-15", bio: "   " });
  assert.equal(blank.ok, true);
  if (blank.ok) assert.equal(blank.data.bio, null);

  const completed = parsePatientProfileInput({
    dateOfBirth: "1990-01-15",
    bio: "  Prefer explicații clare înaintea tratamentului.  ",
  });
  assert.equal(completed.ok, true);
  if (completed.ok) {
    assert.equal(completed.data.bio, "Prefer explicații clare înaintea tratamentului.");
  }
});

test("patient bio rejects content longer than one thousand characters", () => {
  const result = parsePatientProfileInput({
    dateOfBirth: "1990-01-15",
    bio: "a".repeat(1001),
  });
  assert.equal(result.ok, false);
});
