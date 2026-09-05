import assert from "node:assert/strict";
import test from "node:test";

import { UserRole } from "@/generated/prisma/enums";
import { patientProfileAccessWhere } from "./patient-profile-access";
import { patientProfileImageUrl } from "./patient-profile-image";

test("patients can query only their own private profile and image", () => {
  assert.deepEqual(patientProfileAccessWhere({
    id: "patient-one", role: UserRole.PATIENT, emailVerified: true,
  }), { userId: "patient-one" });
});

test("student access requires an appointment with that patient's profile", () => {
  assert.deepEqual(patientProfileAccessWhere({
    id: "student-one", role: UserRole.STUDENT, emailVerified: true,
  }), {
    appointments: { some: { studentProfile: { userId: "student-one" } } },
  });
});

test("unverified viewers and administrators do not gain private profile access", () => {
  for (const role of Object.values(UserRole)) {
    assert.deepEqual(patientProfileAccessWhere({
      id: "viewer", role, emailVerified: false,
    }), { id: { in: [] } });
  }
  assert.deepEqual(patientProfileAccessWhere({
    id: "admin", role: UserRole.ADMIN, emailVerified: true,
  }), { id: { in: [] } });
});

test("a missing viewer ID cannot produce an unrestricted profile query", () => {
  assert.deepEqual(patientProfileAccessWhere({
    id: "", role: UserRole.PATIENT, emailVerified: true,
  }), { id: { in: [] } });
});

test("patient photos are optional and use a dedicated private image URL", () => {
  assert.equal(patientProfileImageUrl(null), null);
  assert.equal(patientProfileImageUrl(undefined), null);
  const image = { id: "patient-image-id", updatedAt: new Date("2026-09-05T10:00:00Z") };
  assert.equal(patientProfileImageUrl(image), `/api/patient-profile-images/patient-image-id?v=${image.updatedAt.getTime()}`);
  assert.notEqual(patientProfileImageUrl(image), patientProfileImageUrl({
    ...image, updatedAt: new Date("2026-09-05T10:01:00Z"),
  }));
});
