import assert from "node:assert/strict";
import test from "node:test";
import { requiresStudentAccountSwitch, signUpAccountType, studentJoinDestination, STUDENT_SIGN_UP_PATH } from "./student-signup";

test("student CTA preserves student registration intent for anonymous and non-student users", () => {
  for (const role of [undefined, null, "PATIENT", "ADMIN"]) {
    assert.deepEqual(studentJoinDestination(role), { href: STUDENT_SIGN_UP_PATH, label: "Alătură-te ca student" });
  }
  assert.deepEqual(studentJoinDestination("STUDENT"), { href: "/cont", label: "Deschide contul tău" });
});

test("registration query preselects only a supported account type", () => {
  assert.equal(signUpAccountType("student"), "student");
  for (const value of [undefined, "patient", "admin", "STUDENT", ["student", "patient"], null]) {
    assert.equal(signUpAccountType(value), "patient");
  }
});

test("existing non-student session requires an explicit account switch", () => {
  assert.equal(requiresStudentAccountSwitch("student", "PATIENT"), true);
  assert.equal(requiresStudentAccountSwitch("student", "ADMIN"), true);
  assert.equal(requiresStudentAccountSwitch("student", "STUDENT"), false);
  assert.equal(requiresStudentAccountSwitch("student", undefined), false);
  assert.equal(requiresStudentAccountSwitch("patient", "PATIENT"), false);
});
