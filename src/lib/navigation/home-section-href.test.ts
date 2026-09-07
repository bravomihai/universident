import assert from "node:assert/strict";
import test from "node:test";

import { homeSectionHref } from "./home-section-href";

test("homepage links stay native anchors even when the current hash already matches", () => {
  for (const current of ["https://universident.test/", "https://universident.test/#cum-functioneaza", "https://universident.test/#altceva"]) {
    const url = new URL(current);
    const href = homeSectionHref(url.pathname, "cum-functioneaza");
    assert.equal(href, "#cum-functioneaza");
    assert.equal(new URL(href, url).href, "https://universident.test/#cum-functioneaza");
    assert.equal(homeSectionHref(url.pathname, "cum-functioneaza"), href);
  }
});

test("other pages retain the homepage route and section for Next.js navigation", () => {
  for (const pathname of ["/echipa", "/cont", "/studenti", "/studenti/student-demo-001", null]) {
    assert.equal(homeSectionHref(pathname, "cum-functioneaza"), "/#cum-functioneaza");
  }
});

test("home anchors preserve query parameters and safely encode the section identifier", () => {
  const current = new URL("https://universident.test/?sursa=test#altceva");
  assert.equal(new URL(homeSectionHref(current.pathname, "cum-functioneaza"), current).href,
    "https://universident.test/?sursa=test#cum-functioneaza");
  assert.equal(homeSectionHref("/cont", "secțiune nouă"), "/#sec%C8%9Biune%20nou%C4%83");
});
