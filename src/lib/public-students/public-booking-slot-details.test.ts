import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicBookingSlotDetails } from "@/components/public-students/public-booking-slot-details";

const slot = {
  treatment: { name: "Carii și obturații" },
  location: {
    name: "Clinica Universitară",
    address: "Strada Clinicilor 12",
    city: { name: "Cluj-Napoca" },
  },
  supervisor: { academicTitle: "Conf. dr.", fullName: "Ana Popescu" },
};

test("booking details show the selected supervisor's title and name below the location", () => {
  const markup = renderToStaticMarkup(createElement(PublicBookingSlotDetails, { slot }));
  for (const text of [slot.treatment.name, slot.location.name, slot.location.city.name, slot.location.address, "Profesor supervizor:", "Conf. dr. Ana Popescu"]) {
    assert.ok(markup.includes(text));
  }
  assert.ok(markup.indexOf(slot.location.address) < markup.indexOf("Profesor supervizor:"));
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /<button|<a\s/);
});

test("a supervisor without an academic title is displayed by name without a placeholder", () => {
  const markup = renderToStaticMarkup(createElement(PublicBookingSlotDetails, {
    slot: { ...slot, supervisor: { fullName: "Ioana Ionescu", academicTitle: null } },
  }));
  assert.match(markup, />Ioana Ionescu<\/span>/);
  assert.doesNotMatch(markup, /null|undefined|Conf\. dr\./);
});

test("changing the selected slot displays only that slot's supervisor", () => {
  const selectedSlot = {
    ...slot,
    supervisor: { fullName: "Mihai Georgescu", academicTitle: "Prof. dr." },
  };
  const markup = renderToStaticMarkup(createElement(PublicBookingSlotDetails, { slot: selectedSlot }));
  assert.match(markup, /Prof\. dr\. Mihai Georgescu/);
  assert.ok(!markup.includes(slot.supervisor.fullName));
});

test("booking details render supervisor text safely and allow long names to wrap", () => {
  const markup = renderToStaticMarkup(createElement(PublicBookingSlotDetails, {
    slot: { ...slot, supervisor: { academicTitle: null, fullName: "<script>alert(1)</script>" } },
  }));
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /overflow-wrap:anywhere/);
});
