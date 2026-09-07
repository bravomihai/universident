import assert from "node:assert/strict";
import test from "node:test";

import { publicStudentLocationKey } from "./public-student-location-key";

const location = {
  routeKey: "clinica-centru",
  name: "Clinica Universitară Centru",
  address: "Str. Clinicilor nr. 32, Cluj-Napoca",
  city: { name: "Cluj-Napoca", slug: "cluj-napoca" },
  supervisor: { fullName: "Ana Popescu", academicTitle: null },
};

test("the same clinic with different supervisors has distinct React keys", () => {
  const locations = [
    location,
    { ...location, supervisor: { fullName: "Andrei Ionescu", academicTitle: null } },
  ];
  assert.equal(new Set(locations.map(publicStudentLocationKey)).size, 2);
});

test("separate location records stay distinct even with the same visible details", () => {
  assert.notEqual(
    publicStudentLocationKey(location),
    publicStudentLocationKey({ ...location, routeKey: "clinica-centru-alta-locatie" }),
  );
});

test("a location-supervisor key stays stable when display details change", () => {
  const updatedLocation = {
    ...location,
    name: "Clinica Centru",
    address: "Adresă actualizată",
    supervisor: { ...location.supervisor, academicTitle: "Prof. dr." },
  };
  assert.equal(publicStudentLocationKey(location), publicStudentLocationKey(updatedLocation));
});

test("location-supervisor key encoding cannot collide on separators", () => {
  assert.notEqual(
    publicStudentLocationKey({
      routeKey: "a:b", supervisor: { fullName: "c", academicTitle: null },
    }),
    publicStudentLocationKey({
      routeKey: "a", supervisor: { fullName: "b:c", academicTitle: null },
    }),
  );
});
