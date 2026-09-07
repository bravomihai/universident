import assert from "node:assert/strict";
import test from "node:test";
import { createPublishedProfileReview } from "./profile-review-dto";

const date = new Date("2026-09-07T10:00:00Z");
const patientReview = {
  id: "published-review-id",
  authorUserId: "private-author-id",
  targetUserId: "private-target-id",
  rating: 5,
  comment: "O experiență plăcută.",
  publishedAt: date,
  author: {
    name: "Ana Pop",
    email: "private@example.test",
    patientProfile: {
      profileSlug: "private-patient-slug",
      dateOfBirth: "1995-01-01",
      bio: "Private bio",
      profileImage: { id: "private-image-id", data: "private-bytes", updatedAt: date },
    },
    studentProfile: null,
  },
  appointment: {
    treatmentNameSnapshot: "Consultație",
    scheduledStartsAt: date,
    patientNote: "Private note",
  },
};

test("public reviews show the patient's name and a review-scoped avatar, never a private profile link", () => {
  const review = createPublishedProfileReview(patientReview, "STUDENT");
  assert.ok(review);
  assert.equal(review.reviewerLabel, "Ana Pop");
  assert.equal(review.reviewerHref, null);
  assert.equal(review.reviewerImageUrl, `/api/review-avatars/published-review-id?v=${date.getTime()}`);
  assert.deepEqual(Object.keys(review).sort(), [
    "id", "rating", "comment", "publishedAt", "treatmentName", "appointmentDate",
    "reviewerLabel", "reviewerHref", "reviewerImageUrl",
  ].sort());
  assert.doesNotMatch(JSON.stringify(review), /private|dateOfBirth|patientNote|profileSlug|email/);
});

test("unpublished reviews expose neither author identity nor an avatar", () => {
  for (const targetRole of ["PATIENT", "STUDENT"] as const) {
    assert.equal(createPublishedProfileReview({ ...patientReview, publishedAt: null }, targetRole), null);
  }
});

test("a missing patient photo keeps the name and uses the initials fallback", () => {
  for (const patientProfile of [null, { profileImage: null }]) {
    const review = createPublishedProfileReview({
      ...patientReview, author: { ...patientReview.author, patientProfile },
    }, "STUDENT");
    assert.equal(review?.reviewerLabel, "Ana Pop");
    assert.equal(review?.reviewerImageUrl, null);
    assert.equal(review?.reviewerHref, null);
  }
});

test("student authors have their name, avatar and public professional profile link", () => {
  const review = createPublishedProfileReview({
    ...patientReview,
    author: {
      name: "Mihai Ionescu",
      patientProfile: null,
      studentProfile: {
        publicSlug: "mihai-ionescu", isPublished: true,
        profileImage: { updatedAt: date },
      },
    },
  }, "PATIENT");
  assert.equal(review?.reviewerLabel, "Mihai Ionescu");
  assert.equal(review?.reviewerHref, "/studenti/mihai-ionescu");
  assert.equal(review?.reviewerImageUrl, `/api/review-avatars/published-review-id?v=${date.getTime()}`);
});

test("withdrawn student profiles retain review identity without a broken public profile link", () => {
  const review = createPublishedProfileReview({
    ...patientReview,
    author: {
      name: "Mihai Ionescu", patientProfile: null,
      studentProfile: { publicSlug: "mihai-ionescu", isPublished: false, profileImage: null },
    },
  }, "PATIENT");
  assert.equal(review?.reviewerLabel, "Mihai Ionescu");
  assert.equal(review?.reviewerHref, null);
  assert.equal(review?.reviewerImageUrl, null);
});

test("review avatar URL changes when the author replaces the photo", () => {
  const changed = createPublishedProfileReview({
    ...patientReview,
    author: { ...patientReview.author, patientProfile: {
      profileImage: { updatedAt: new Date(date.getTime() + 1000) },
    } },
  }, "STUDENT");
  assert.notEqual(changed?.reviewerImageUrl, createPublishedProfileReview(patientReview, "STUDENT")?.reviewerImageUrl);
});
