import assert from "node:assert/strict";
import test from "node:test";
import { homeStructuredData, serializeJsonLd, studentProfileStructuredData, studentSearchStructuredData } from "./structured-data";
import { platformDescription, publicAnswers, studentStudyDescription } from "./public-answers";

test("the website description is a visible answer and does not invent clinical credentials", () => {
  const data = homeStructuredData();
  const graph = data["@graph"] as Record<string, unknown>[];
  assert.equal(graph[0]["@type"], "WebSite");
  assert.equal(graph[0].url, "https://universident.ro/");
  assert.equal(graph[0].description, platformDescription);
  assert.ok(publicAnswers.some((answer) => answer.answer === graph[0].description));
  assert.doesNotMatch(JSON.stringify(data), /MedicalClinic|Dentist|AggregateRating|price|award/);
});

test("profile markup uses a Person and explicitly projects only public student facts", () => {
  const profile = {
    publicSlug: "student-ana", university: "Universitate de test", studyYear: 4,
    user: { name: "Ana", email: "private@example.invalid", id: "private-account" },
    patientNote: "Private note", reviewData: { reviews: [{ name: "Private patient" }] },
  };
  const data = studentProfileStructuredData(profile)!;
  const person = data.mainEntity as Record<string, unknown>;
  assert.equal(data["@type"], "ProfilePage");
  assert.equal(person["@type"], "Person");
  assert.equal(person.description, studentStudyDescription(profile.university, profile.studyYear));
  assert.equal(person.url, "https://universident.ro/studenti/student-ana");
  assert.doesNotMatch(JSON.stringify(data), /private|Private|email|review|Dentist|alumniOf/i);
  assert.equal(studentProfileStructuredData(null), null);
});

test("JSON-LD escapes closing script tags while preserving the original JSON strings", () => {
  const data = { name: '</script><script>alert("test")</script>&\u2028\u2029' };
  const serialized = serializeJsonLd(data);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(serialized), data);
});

const treatment = { name: "Igienizare dentară", slug: "igienizare" };
const city = { name: "Cluj-Napoca", slug: "cluj-napoca" };
const params = { tratament: treatment.slug, oras: city.slug };
const results = [{ publicSlug: "student-ana", name: "Ana" }, { publicSlug: "student-ion", name: "Ion" }];

test("result markup reflects only the displayed page and retains its filter canonical", () => {
  const data = studentSearchStructuredData({ params: { ...params, pagina: "2", utm_source: "test" }, treatment, city, results, pageSize: 12 })!;
  assert.equal(data["@type"], "CollectionPage");
  assert.equal(data.url, "https://universident.ro/studenti?tratament=igienizare&oras=cluj-napoca&pagina=2");
  assert.deepEqual(data.mainEntity, {
    "@type": "ItemList", itemListElement: [
      { "@type": "ListItem", position: 13, name: "Ana", url: "https://universident.ro/studenti/student-ana" },
      { "@type": "ListItem", position: 14, name: "Ion", url: "https://universident.ro/studenti/student-ion" },
    ],
  });
});

test("empty, partial and invalid searches publish no structured result claims", () => {
  const cases = [
    { params, treatment, city, results: [] },
    { params: { tratament: treatment.slug }, treatment, results: [] },
    { params: { ...params, pagina: "abc" }, treatment, city, results },
    { params: { ...params, oras: [city.slug, "iasi"] }, treatment, city, results },
    { params: { pagina: "2" }, results: [] },
  ];
  for (const input of cases) assert.equal(studentSearchStructuredData({ ...input, pageSize: 12 }), null);
  const directory = studentSearchStructuredData({ params: {}, results: [], pageSize: 12 })!;
  assert.equal(directory.url, "https://universident.ro/studenti");
  assert.equal(directory.mainEntity, undefined);
});
