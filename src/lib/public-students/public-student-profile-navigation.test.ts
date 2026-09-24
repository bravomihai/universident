import assert from "node:assert/strict";
import test from "node:test";
import { publicStudentProfileHref } from "./public-student-profile-navigation";

test("profile links use clean URLs without navigation metadata", () => {
  assert.equal(publicStudentProfileHref("student-test"), "/studenti/student-test");
  assert.equal(publicStudentProfileHref("student-test", { section: "recenzii" }), "/studenti/student-test#recenzii");
});

test("profile links retain functional treatment/city highlighting and section anchors", () => {
  assert.equal(publicStudentProfileHref("student-test", {
    treatmentSlug: "carii", citySlug: "cluj-napoca", section: "tratamente",
  }), "/studenti/student-test?tratament=carii&oras=cluj-napoca#tratamente");
});

test("profile slugs remain encoded as a single route segment", () => {
  assert.equal(publicStudentProfileHref("student/test?x"), "/studenti/student%2Ftest%3Fx");
});
