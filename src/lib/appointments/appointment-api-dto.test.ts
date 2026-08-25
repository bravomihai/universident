import assert from "node:assert/strict";
import test from "node:test";

import { toAppointmentApiDto } from "@/lib/appointments/appointment-api-dto";

test("private appointment DTO omits internal scheduling and account IDs", () => {
  const appointment = {
    id: "appointment-id",
    patientProfileId: "patient-profile-id",
    studentProfileId: "student-profile-id",
    studentAvailabilitySlotId: "slot-id",
    studentAvailabilitySlotOfferingId: "offering-id",
    statusChangedByUserId: "actor-user-id",
    routeSlug: "consultatie-1",
    scheduledStartsAt: new Date("2026-09-01T09:00:00.000Z"),
    scheduledEndsAt: new Date("2026-09-01T10:00:00.000Z"),
    patientAgeAtAppointment: 31,
    patientNote: null,
    patientNameSnapshot: "Pacient Test",
    studentNameSnapshot: "Student Test",
    treatmentNameSnapshot: "Consultație",
    locationNameSnapshot: "Clinică",
    locationAddressSnapshot: "Adresă test",
    supervisorNameSnapshot: "Dr. Coordonator",
    status: "PENDING",
    version: 1,
    statusReason: null,
    isLateCancellation: false,
    patientProfile: {
      id: "patient-profile-id",
      profileSlug: "pacient-test",
      user: {
        id: "patient-user-id",
        name: "Pacient Test",
        reviewsReceived: [{ rating: 5 }],
      },
    },
    studentProfile: {
      id: "student-profile-id",
      publicSlug: "student-test",
      university: "UMFCD",
      studyYear: 4,
      user: {
        id: "student-user-id",
        name: "Student Test",
        reviewsReceived: [{ rating: 4 }],
      },
    },
    reviews: [{ authorRole: "PATIENT", submittedAt: new Date("2026-09-01T11:00:00.000Z") }],
  };

  const dto = toAppointmentApiDto(appointment);
  assert.equal(dto.routeSlug, "consultatie-1");
  assert.equal("id" in dto, false);
  assert.equal("patientProfileId" in dto, false);
  assert.equal("studentAvailabilitySlotId" in dto, false);
  assert.equal("statusChangedByUserId" in dto, false);
  assert.equal("id" in dto.patientProfile, false);
  assert.equal("id" in dto.patientProfile.user, false);
  assert.equal("id" in dto.studentProfile.user, false);
});
