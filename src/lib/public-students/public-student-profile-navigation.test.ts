import assert from "node:assert/strict";
import test from "node:test";

import { publicStudentProfileBackLink, publicStudentProfileFromHomeHref, publicStudentProfileHref } from "./public-student-profile-navigation";
import { publicStudentBookingHref } from "./public-student-booking-links";

test("homepage profile links return to the homepage, including after a reload", () => {
  const href = publicStudentProfileFromHomeHref("student-test");
  assert.equal(href, "/studenti/student-test?sursa=acasa");
  const source = new URL(href, "https://example.test").searchParams.get("sursa") ?? undefined;
  assert.deepEqual(publicStudentProfileBackLink(source), {
    href: "/", label: "Înapoi la pagina principală",
  });
});

test("profile links from search preserve the treatment and city", () => {
  assert.deepEqual(publicStudentProfileBackLink(undefined, {
    treatmentSlug: "carii-si-obturatii", citySlug: "cluj-napoca",
  }), {
    href: "/studenti?tratament=carii-si-obturatii&oras=cluj-napoca",
    label: "Înapoi la rezultate",
  });
});

test("direct profile visits and unrecognized sources keep the search fallback", () => {
  for (const source of [undefined, "", "https://example.test", ["acasa", "elsewhere"]]) {
    assert.deepEqual(publicStudentProfileBackLink(source), {
      href: "/studenti", label: "Înapoi la căutare",
    });
  }
});

test("the explicit homepage origin takes precedence over highlighting a treatment", () => {
  assert.deepEqual(publicStudentProfileBackLink("acasa", {
    treatmentSlug: "carii", citySlug: "cluj-napoca",
  }), { href: "/", label: "Înapoi la pagina principală" });
});

test("homepage links encode the student slug as a single route segment", () => {
  assert.equal(publicStudentProfileFromHomeHref("student/test?x"), "/studenti/student%2Ftest%3Fx?sursa=acasa");
});

test("homepage origin survives repeated profile-calendar-profile round trips", () => {
  const origin = "https://example.test";
  let profileUrl = new URL(publicStudentProfileFromHomeHref("student-test"), origin);
  for (let visit = 0; visit < 3; visit += 1) {
    const bookingUrl = new URL(publicStudentBookingHref(
      "student-test", "carii", "cluj-napoca", "a123bc",
      profileUrl.searchParams.get("sursa") === "acasa" ? "acasa" : undefined,
    ), origin);
    assert.equal(bookingUrl.searchParams.get("locatie"), "a123bc");
    assert.equal(bookingUrl.searchParams.get("sursa"), "acasa");
    profileUrl = new URL(publicStudentProfileHref("student-test", {
      source: bookingUrl.searchParams.get("sursa") ?? undefined,
      treatmentSlug: "carii", citySlug: "cluj-napoca", section: "tratamente",
    }), origin);
    assert.equal(profileUrl.hash, "#tratamente");
    assert.deepEqual(publicStudentProfileBackLink(
      profileUrl.searchParams.get("sursa") ?? undefined,
      { treatmentSlug: "carii", citySlug: "cluj-napoca" },
    ), { href: "/", label: "Înapoi la pagina principală" });
  }
});

test("returning through the review link also preserves homepage origin", () => {
  const href = publicStudentProfileHref("student-test", { source: "acasa", section: "recenzii" });
  assert.equal(href, "/studenti/student-test?sursa=acasa#recenzii");
  const source = new URL(href, "https://example.test").searchParams.get("sursa") ?? undefined;
  assert.deepEqual(publicStudentProfileBackLink(source), { href: "/", label: "Înapoi la pagina principală" });
});

test("calendar returns without homepage origin retain search context", () => {
  const href = publicStudentProfileHref("student-test", {
    treatmentSlug: "carii", citySlug: "cluj-napoca", section: "tratamente",
  });
  const url = new URL(href, "https://example.test");
  assert.equal(url.searchParams.has("sursa"), false);
  assert.deepEqual(publicStudentProfileBackLink(undefined, {
    treatmentSlug: url.searchParams.get("tratament")!, citySlug: url.searchParams.get("oras")!,
  }), { href: "/studenti?tratament=carii&oras=cluj-napoca", label: "Înapoi la rezultate" });
  assert.equal(publicStudentProfileHref("student-test", { section: "recenzii" }), "/studenti/student-test#recenzii");
});

test("profile return URLs propagate only the recognized homepage source", () => {
  for (const source of ["https://example.test/redirect", "", ["acasa", "elsewhere"]]) {
    const href = publicStudentProfileHref("student-test", { source, section: "recenzii" });
    assert.equal(href, "/studenti/student-test#recenzii");
  }
});
