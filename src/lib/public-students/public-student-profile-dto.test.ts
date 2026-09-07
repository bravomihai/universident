import assert from "node:assert/strict";
import test from "node:test";

import { AppointmentStatus } from "@/generated/prisma/enums";
import { createPublicStudentProfile } from "./public-student-profile-dto";

const profile = {
  user: { name: "Student" },
  publicSlug: "student-test",
  university: "Universitate",
  studyYear: 4,
  bio: null,
  profileImage: null,
  appointments: [],
};
const reviewData = {
  summary: { averageRating: null, reviewCount: 0 },
  reviews: [],
};

test("public student reputation is zero without confirmed appointments", () => {
  const result = createPublicStudentProfile(profile, [], reviewData);
  assert.equal(result?.cancellationsLast10, 0);
});

test("public student reputation counts only cancellations by the student", () => {
  const result = createPublicStudentProfile({
    ...profile,
    appointments: [
      { status: AppointmentStatus.CANCELLED_BY_STUDENT },
      { status: AppointmentStatus.COMPLETED },
      { status: AppointmentStatus.CANCELLED_BY_PATIENT },
      { status: AppointmentStatus.CONFIRMED },
      { status: AppointmentStatus.CANCELLED_BY_STUDENT },
      { status: AppointmentStatus.NO_SHOW },
    ],
  }, [], reviewData);
  assert.equal(result?.cancellationsLast10, 2);
});

test("public student reputation supports all ten confirmed appointments cancelled", () => {
  const result = createPublicStudentProfile({
    ...profile,
    appointments: Array.from({ length: 10 }, () => ({
      status: AppointmentStatus.CANCELLED_BY_STUDENT,
    })),
  }, [], reviewData);
  assert.equal(result?.cancellationsLast10, 10);
});

test("public student DTO exposes the cancellation count without private appointment data", () => {
  const source = {
    ...profile,
    id: "private-profile-id",
    userId: "private-user-id",
    user: { name: "Student", email: "private@example.test" },
    appointments: [{
      id: "private-appointment-id",
      status: AppointmentStatus.CANCELLED_BY_STUDENT,
      patientNameSnapshot: "Private patient",
      statusReason: "Private reason",
      patientNote: "Private note",
    }],
  };
  const result = createPublicStudentProfile(source, [], reviewData);
  assert.ok(result);
  assert.equal(result.cancellationsLast10, 1);
  assert.deepEqual(Object.keys(result).sort(), [
    "name", "imageUrl", "publicSlug", "university", "studyYear", "bio",
    "treatments", "reviewData", "cancellationsLast10",
  ].sort());
  assert.equal(JSON.stringify(result).includes("Private"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("public student DTO still requires a public slug", () => {
  assert.equal(createPublicStudentProfile({
    ...profile, publicSlug: null,
  }, [], reviewData), null);
});
