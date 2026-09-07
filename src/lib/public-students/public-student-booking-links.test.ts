import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicStudentLocationCard } from "@/components/public-students/public-student-location-card";
import { parsePublicBookingLocation, publicBookingLocationWhere } from "./public-booking-location";
import { publicStudentAvailabilityHref, publicStudentBookingHref } from "./public-student-booking-links";

test("search links retain the city-wide booking route", () => {
  assert.equal(publicStudentBookingHref("student", "carii", "cluj-napoca"), "/studenti/student/programare/carii/cluj-napoca");
  assert.equal(new URL(publicStudentAvailabilityHref("student", "carii", "cluj-napoca"), "https://example.test").searchParams.has("locatie"), false);
});

test("profile links carry the treatment, city and exact location through to the availability API", () => {
  const href = publicStudentBookingHref("student", "carii", "cluj-napoca", "a123bc");
  assert.equal(href, "/studenti/student/programare/carii/cluj-napoca?locatie=a123bc");
  const location = parsePublicBookingLocation(new URL(href, "https://example.test").searchParams.get("locatie"));
  assert.equal(location, "a123bc");
  const api = new URL(publicStudentAvailabilityHref("student", "carii", "cluj-napoca", location!), "https://example.test");
  assert.equal(api.pathname, "/api/studenti/student/disponibilitati");
  assert.deepEqual(Object.fromEntries(api.searchParams), { tratament: "carii", oras: "cluj-napoca", locatie: "a123bc" });
});

test("location filters remain constrained to the selected city and non-archived locations", () => {
  assert.deepEqual(publicBookingLocationWhere("cluj-napoca", "a123bc"), {
    deletedAt: null, city: { slug: "cluj-napoca", isActive: true }, routeKey: "a123bc",
  });
  assert.deepEqual(publicBookingLocationWhere("cluj-napoca"), {
    deletedAt: null, city: { slug: "cluj-napoca", isActive: true },
  });
});

test("invalid or repeated location filters are rejected rather than widening the calendar", () => {
  assert.equal(parsePublicBookingLocation(undefined), undefined);
  assert.equal(parsePublicBookingLocation(null), undefined);
  for (const value of ["", "ABCDEF", "12345", "1234567", " a123bc ", "../a123bc", ["a123bc", "d456ef"]]) {
    assert.equal(parsePublicBookingLocation(value), null);
  }
});

test("booking URLs encode individual route segments and query values", () => {
  assert.equal(publicStudentBookingHref("student/name", "t?x", "c#x", "a&b"),
    "/studenti/student%2Fname/programare/t%3Fx/c%23x?locatie=a%26b");
});

test("a profile location renders as one accessible link with the shared card interaction styles", () => {
  const markup = renderToStaticMarkup(createElement(PublicStudentLocationCard, {
    studentSlug: "student", treatmentSlug: "carii", treatmentName: "Carii și obturații",
    location: {
      routeKey: "a123bc", name: "Clinica", address: "Adresă",
      city: { name: "Cluj-Napoca", slug: "cluj-napoca" },
      supervisor: { fullName: "Ana Popescu", academicTitle: "Prof. dr." },
    },
  }));
  assert.equal((markup.match(/<a\s/g) ?? []).length, 1);
  assert.equal(markup.includes("<button"), false);
  assert.match(markup, /href="\/studenti\/student\/programare\/carii\/cluj-napoca\?locatie=a123bc"/);
  assert.match(markup, /aria-label="Alege o programare pentru Carii și obturații la Clinica, Cluj-Napoca/);
  assert.match(markup, /ui-card-link/);
  assert.match(markup, /ui-card-interactive/);
});

test("a location card opened from the homepage forwards the source to the calendar", () => {
  const markup = renderToStaticMarkup(createElement(PublicStudentLocationCard, {
    studentSlug: "student", treatmentSlug: "carii", treatmentName: "Carii și obturații",
    profileSource: "acasa",
    location: {
      routeKey: "a123bc", name: "Clinica", address: "Adresă",
      city: { name: "Cluj-Napoca", slug: "cluj-napoca" },
      supervisor: { fullName: "Ana Popescu", academicTitle: null },
    },
  }));
  assert.match(markup, /href="\/studenti\/student\/programare\/carii\/cluj-napoca\?locatie=a123bc&amp;sursa=acasa"/);
});
