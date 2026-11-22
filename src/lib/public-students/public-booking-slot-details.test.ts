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
};

test("booking details show the student university below the location", () => {
  const university = "UMF Cluj-Napoca";
  const label = "Tratament supervizat de un cadru didactic UMF Cluj-Napoca";
  const markup = renderToStaticMarkup(createElement(PublicBookingSlotDetails, { slot, university }));
  for (const text of [slot.treatment.name, slot.location.name, slot.location.city.name, slot.location.address, label]) {
    assert.ok(markup.includes(text));
  }
  assert.ok(markup.indexOf(slot.location.address) < markup.indexOf(label));
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /<button|<a\s/);
});
