import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@/generated/prisma/enums";
import { reviewAvatarAccessWhere } from "./review-avatar-access";

const publicReview = {
  authorRole: "PATIENT",
  target: {
    role: "STUDENT", emailVerified: true,
    studentProfile: {
      isPublished: true, publicSlug: { not: null },
      university: { not: "" }, studyYear: { gte: 1, lte: 6 },
    },
  },
};

test("anonymous avatar requests require a published review on a visible, verified student profile", () => {
  assert.deepEqual(reviewAvatarAccessWhere("review-one"), {
    id: "review-one", publishedAt: { not: null }, OR: [publicReview],
  });
});

test("patients can additionally see avatars only in their own private review profile", () => {
  assert.deepEqual(reviewAvatarAccessWhere("review-one", {
    id: "patient-one", role: UserRole.PATIENT, emailVerified: true,
  }), {
    id: "review-one", publishedAt: { not: null }, OR: [publicReview, {
      authorRole: "STUDENT", target: { patientProfile: { userId: "patient-one" } },
    }],
  });
});

test("student access to private review avatars requires an appointment with that patient", () => {
  assert.deepEqual(reviewAvatarAccessWhere("review-one", {
    id: "student-one", role: UserRole.STUDENT, emailVerified: true,
  }), {
    id: "review-one", publishedAt: { not: null }, OR: [publicReview, {
      authorRole: "PATIENT", targetUserId: "student-one",
    }, {
      authorRole: "STUDENT", target: { patientProfile: {
        appointments: { some: { studentProfile: { userId: "student-one" } } },
      } },
    }],
  });
});

test("unverified users, empty IDs and admins gain no additional access to review images", () => {
  const publicOnly = reviewAvatarAccessWhere("review-one");
  for (const role of Object.values(UserRole)) {
    assert.deepEqual(reviewAvatarAccessWhere("review-one", {
      id: "viewer", role, emailVerified: false,
    }), publicOnly);
    assert.deepEqual(reviewAvatarAccessWhere("review-one", {
      id: "", role, emailVerified: true,
    }), publicOnly);
  }
  assert.deepEqual(reviewAvatarAccessWhere("review-one", {
    id: "admin-one", role: UserRole.ADMIN, emailVerified: true,
  }), publicOnly);
});
