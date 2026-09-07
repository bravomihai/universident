import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppointmentInformationGrid } from "@/components/appointments/appointment-information-grid";
import { AppointmentStatusBadges } from "@/components/appointments/appointment-status-badges";
import { AppointmentSummaryCard } from "@/components/appointments/appointment-summary-card";
import { Button } from "@/components/ui/button";
import { appointmentCounterpart, type AppointmentCardSource } from "./appointment-card-data";

const appointment: AppointmentCardSource = {
  routeSlug: "programare-test", version: 3, status: "CONFIRMED",
  scheduledStartsAt: "2026-09-08T10:00:00Z", scheduledEndsAt: "2026-09-08T11:00:00Z",
  patientNameSnapshot: "Maria Pacient", studentNameSnapshot: "Andrei Student", patientAgeAtAppointment: 27,
  treatmentNameSnapshot: "Consultație", locationNameSnapshot: "Clinica Universitară", locationAddressSnapshot: "Strada Clinicilor 12, Cluj-Napoca",
  supervisorNameSnapshot: "Prof. Ana Supervizor", patientNote: "Mesaj privat de programare", statusReason: null,
  patientProfile: {
    profileSlug: "pacient-privat", profileImage: { id: "patient-photo", updatedAt: new Date("2026-09-01T00:00:00Z") },
    user: { reviewsReceived: [{ rating: 5 }, { rating: 3 }] },
  },
  studentProfile: {
    publicSlug: "andrei-student", isPublished: true, university: "UMF Cluj-Napoca", studyYear: 4,
    profileImage: { id: "student-photo", updatedAt: new Date("2026-09-01T00:00:00Z") },
    user: { role: "STUDENT", emailVerified: true, reviewsReceived: [{ rating: 5 }] },
  },
  reviews: [],
};

// Layout tests exercise the shared initials avatar. The Next Image component
// needs Next's module interop; image URL selection is tested separately below.
function layoutCounterpart(source: AppointmentCardSource, role: "PATIENT" | "STUDENT") {
  return { ...appointmentCounterpart(source, role), imageUrl: null };
}

test("the patient sees the student's snapshot name and public profile; the student sees the authorized patient", () => {
  const student = appointmentCounterpart(appointment, "PATIENT");
  assert.equal(student.name, appointment.studentNameSnapshot);
  assert.equal(student.label, "Student");
  assert.equal(student.href, "/studenti/andrei-student");
  assert.match(student.imageUrl!, /^\/api\/student-profile-images\/student-photo\?v=/);
  assert.equal(student.subtitle, "UMF Cluj-Napoca · Anul 4");
  const patient = appointmentCounterpart(appointment, "STUDENT");
  assert.equal(patient.name, appointment.patientNameSnapshot);
  assert.equal(patient.label, "Pacient");
  assert.equal(patient.href, "/pacienti/pacient-privat");
  assert.equal(patient.subtitle, "27 ani la programare");
  assert.match(patient.imageUrl!, /^\/api\/patient-profile-images\/patient-photo\?v=/);
  assert.deepEqual(patient.summary, { averageRating: 4, reviewCount: 2 });
});

test("unavailable student profiles retain snapshot identity without a broken link or private image", () => {
  const cases = [
    { ...appointment.studentProfile, isPublished: false },
    { ...appointment.studentProfile, publicSlug: null },
    { ...appointment.studentProfile, university: "" },
    { ...appointment.studentProfile, studyYear: 0 },
    { ...appointment.studentProfile, user: { ...appointment.studentProfile.user, emailVerified: false } },
    { ...appointment.studentProfile, user: { ...appointment.studentProfile.user, role: "PATIENT" } },
  ];
  for (const studentProfile of cases) {
    const counterpart = appointmentCounterpart({ ...appointment, studentProfile }, "PATIENT");
    assert.equal(counterpart.name, appointment.studentNameSnapshot);
    assert.equal(counterpart.href, null);
    assert.equal(counterpart.imageUrl, null);
  }
});

test("counterpart presentation never copies patient email, birth date, image bytes or unrelated data", () => {
  const source = { ...appointment, patientProfile: { ...appointment.patientProfile,
    dateOfBirth: "1990-01-01", user: { ...appointment.patientProfile.user, email: "private@example.test" },
    profileImage: { ...appointment.patientProfile.profileImage!, data: "SECRET_IMAGE_BYTES" },
  } };
  const json = JSON.stringify(appointmentCounterpart(source, "STUDENT"));
  for (const privateValue of ["1990-01-01", "private@example.test", "SECRET_IMAGE_BYTES"]) assert.equal(json.includes(privateValue), false);
});

test("missing optional photos and ratings use fallbacks without changing the profile destination", () => {
  const source = { ...appointment, patientProfile: { ...appointment.patientProfile, profileImage: null, user: { reviewsReceived: [] } } };
  const counterpart = appointmentCounterpart(source, "STUDENT");
  assert.equal(counterpart.imageUrl, null);
  assert.deepEqual(counterpart.summary, { averageRating: null, reviewCount: 0 });
  assert.equal(counterpart.href, "/pacienti/pacient-privat");
});

test("details have exactly one clickable profile and preserve the requested four-panel order", () => {
  for (const role of ["PATIENT", "STUDENT"] as const) {
    const counterpart = layoutCounterpart(appointment, role);
    const markup = renderToStaticMarkup(createElement(AppointmentInformationGrid, { appointment, counterpart }));
    assert.equal((markup.match(/<a\s/g) ?? []).length, 1);
    assert.match(markup, /ui-card-link/);
    assert.match(markup, /ui-card-interactive/);
    assert.match(markup, /sm:grid-cols-2/);
    assert.ok(markup.includes(`href="${counterpart.href}"`));
    const positions = [counterpart.name, "Profesor supervizor", "Locație", "Mesajul pacientului"].map((label) => markup.indexOf(label));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.ok(markup.includes(appointment.locationAddressSnapshot));
    assert.ok(markup.includes(appointment.supervisorNameSnapshot));
    assert.ok(markup.includes(appointment.patientNote!));
  }
});

test("details escape patient text, retain line breaks and display cancellation reasons", () => {
  const source = { ...appointment, patientNote: "<script>alert(1)</script>\nA doua linie", statusReason: "Motivul anulării" };
  const markup = renderToStaticMarkup(createElement(AppointmentInformationGrid, { appointment: source, counterpart: layoutCounterpart(source, "PATIENT") }));
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /whitespace-pre-wrap/);
  assert.match(markup, /Motivul anulării/);
});

test("details handle missing notes and withdrawn profiles without fake interactive controls", () => {
  const source = { ...appointment, patientNote: null, studentProfile: { ...appointment.studentProfile, isPublished: false } };
  const markup = renderToStaticMarkup(createElement(AppointmentInformationGrid, { appointment: source, counterpart: appointmentCounterpart(source, "PATIENT") }));
  assert.doesNotMatch(markup, /<a\s|ui-card-interactive/);
  assert.match(markup, /Nu a fost adăugat niciun mesaj/);
  assert.match(markup, /Profilul nu este disponibil public/);
});

test("summary cards keep only the detail link and cancel action, with the required summary data", () => {
  for (const role of ["PATIENT", "STUDENT"] as const) {
    const counterpart = layoutCounterpart(appointment, role);
    const markup = renderToStaticMarkup(createElement(AppointmentSummaryCard, {
      appointment, counterpart, role, isUnread: true, needsAttention: false,
      cancelAction: createElement(Button, { variant: "destructive" }, "Anulează"),
    }));
    assert.equal((markup.match(/<a\s/g) ?? []).length, 1);
    assert.equal((markup.match(/<button\s/g) ?? []).length, 1);
    assert.match(markup, /href="\/cont\/programari\/programare-test"/);
    assert.ok(markup.indexOf("Vezi detaliile") < markup.indexOf("Anulează"));
    for (const visible of [counterpart.name, "Confirmată", "Nou", appointment.treatmentNameSnapshot, appointment.locationNameSnapshot, "13:00–14:00", "2026"]) assert.ok(markup.includes(visible));
    for (const omitted of [appointment.patientNote!, appointment.supervisorNameSnapshot, "Vezi recenziile", "Trimite recenzia"]) assert.equal(markup.includes(omitted), false);
  }
});

test("closed summaries keep details without inventing a cancel action", () => {
  const markup = renderToStaticMarkup(createElement(AppointmentSummaryCard, {
    appointment: { ...appointment, status: "COMPLETED" }, counterpart: layoutCounterpart(appointment, "PATIENT"),
    role: "PATIENT", isUnread: false, needsAttention: false, cancelAction: null,
  }));
  assert.match(markup, /Finalizată/);
  assert.doesNotMatch(markup, /<button\s|Anulează/);
});

test("attention markers no longer replace the actual appointment status", () => {
  const markup = renderToStaticMarkup(createElement(AppointmentStatusBadges, { status: "CONFIRMED", role: "STUDENT", needsAttention: true }));
  assert.match(markup, /Confirmată/);
  assert.match(markup, /Necesită închidere/);
  const review = renderToStaticMarkup(createElement(AppointmentStatusBadges, { status: "COMPLETED", role: "PATIENT", needsAttention: true }));
  assert.match(review, /Finalizată/);
  assert.match(review, /Recenzie necesară/);
});
