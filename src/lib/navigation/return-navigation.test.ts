import assert from "node:assert/strict";
import test from "node:test";
import { cleanNavigationHref, contextualBackLink, navigationSource, nextNavigationEntry, readNavigationEntry, type NavigationEntry, type NavigationMode } from "./return-navigation";
import { createNavigationStore, NAVIGATION_STATE_KEY } from "./navigation-store";

const conversation = "/cont/mesaje/012345abcdef";
const appointment = "/cont/programari/programare-test";
const profile = "/studenti/student-test";
const booking = `${profile}/programare/carii/cluj-napoca?locatie=clinica-test`;
const homeBack = { href: "/", label: "Înapoi la pagina principală" };
function go(href: string, current: NavigationEntry | null = null, mode?: NavigationMode) {
  const entry = nextNavigationEntry(href, current, mode);
  assert.ok(entry);
  return entry;
}
function harness(initialHref = "/") {
  const entries = [{ href: initialHref, state: { nextRouter: "preserved" } as Record<string, unknown> }];
  let index = 0;
  const bridge = {
    href: () => entries[index].href,
    state: () => entries[index].state,
    replace: (state: Record<string, unknown>, href?: string) => { entries[index] = { href: href ?? entries[index].href, state }; },
  };
  let store = createNavigationStore(bridge);
  store.sync();
  return {
    bridge, entries,
    current: () => entries[index],
    snapshot: () => store.getSnapshot(),
    prepare: (href: string) => store.prepare(href),
    navigate(href: string, mode: NavigationMode = "forward") {
      const clean = store.prepare(href, mode);
      entries.splice(index + 1);
      entries.push({ href: clean, state: { nextRouter: "preserved" } });
      index++;
      store.sync();
    },
    traverse(delta: number) { index += delta; store.sync(true); },
    reload() { store = createNavigationStore(bridge); store.sync(); },
    refresh() { store.sync(); },
  };
}

test("messages → conversation → appointment injects state while all URLs stay clean", () => {
  const app = harness("/cont");
  app.navigate("/cont/mesaje");
  app.navigate(conversation);
  app.navigate(appointment);
  assert.equal(app.current().href, appointment);
  assert.deepEqual(contextualBackLink(app.snapshot()), { href: conversation, label: "Înapoi la mesaje" });
  app.navigate(conversation, "back");
  assert.deepEqual(contextualBackLink(app.snapshot()), { href: "/cont/mesaje", label: "Înapoi la mesaje" });
  app.navigate("/cont/mesaje", "back");
  assert.deepEqual(contextualBackLink(app.snapshot()), { href: "/cont", label: "Înapoi la cont" });
  assert.ok(app.entries.every(entry => !entry.href.includes("inapoi=")));
  assert.equal(app.current().state.nextRouter, "preserved");
});

test("reload and browser back/forward retain separate contexts for repeated visits to the same URL", () => {
  const app = harness("/cont/mesaje");
  app.navigate(conversation);
  app.navigate(appointment);
  app.navigate("/cont/calendar");
  app.navigate(appointment, "reset");
  assert.deepEqual(contextualBackLink(app.snapshot()), homeBack);
  app.traverse(-2);
  assert.equal(app.current().href, appointment);
  assert.equal(contextualBackLink(app.snapshot()).href, conversation);
  app.reload();
  assert.equal(contextualBackLink(app.snapshot()).href, conversation);
  app.traverse(2);
  assert.deepEqual(contextualBackLink(app.snapshot()), homeBack);
});

test("direct visits, new tabs and missing or invalid state always return home", () => {
  for (const href of [appointment, conversation, profile, booking, "/cont/calendar", "/echipa"]) {
    assert.deepEqual(contextualBackLink(harness(href).snapshot()), homeBack);
  }
  assert.deepEqual(contextualBackLink(null), homeBack);
  const app = harness(appointment);
  app.current().state[NAVIGATION_STATE_KEY] = { href: appointment, trail: ["https://example.test"] };
  app.reload();
  assert.deepEqual(contextualBackLink(app.snapshot()), homeBack);
});

test("filtered and paginated results survive the profile and booking round trip", () => {
  const results = "/studenti?tratament=carii&oras=cluj-napoca&pagina=3";
  const student = go(profile, go(results));
  const calendar = go(booking, student);
  assert.equal(contextualBackLink(calendar).href, profile);
  assert.equal(contextualBackLink(go(profile, calendar, "back")).href, results);
  assert.equal(calendar.href, booking);
});

test("revisiting an ancestor consumes intervening steps instead of creating a loop", () => {
  let student = go(profile, go("/"));
  for (let i = 0; i < 25; i++) {
    const calendar = go(booking, student);
    student = go(`${profile}?tratament=carii&oras=cluj-napoca#recenzii`, calendar);
    assert.deepEqual(contextualBackLink(student), homeBack);
    assert.equal(student.trail.length, 1);
  }
  const detail = go(appointment, go("/cont/programari"));
  assert.deepEqual(go(appointment, go(conversation, detail)), detail);
});

test("query and section changes do not create return steps and source anchors are retained", () => {
  const results = go("/studenti?tratament=carii&oras=iasi", go("/#cum-functioneaza"));
  const nextPage = go("/studenti?tratament=carii&oras=iasi&pagina=2", results);
  assert.deepEqual(nextPage.trail, ["/#cum-functioneaza"]);
  assert.equal(contextualBackLink(nextPage).href, "/#cum-functioneaza");
  const student = go(profile, nextPage);
  assert.deepEqual(readNavigationEntry(student, `${profile}#recenzii`)?.trail, student.trail);
});

test("peer navigation and saved/cancelled forms preserve the parent", () => {
  const chat = go(conversation, go("/cont/mesaje"));
  assert.equal(contextualBackLink(go("/cont/mesaje/abcdef012345", chat, "replace")).href, "/cont/mesaje");
  const locations = go("/cont/locatii", go("/cont"));
  const editor = go("/cont/locatii/nou", locations);
  assert.deepEqual(go("/cont/locatii", editor, "replace"), locations);
  assert.deepEqual(go("/cont/locatii", editor), locations);
  assert.deepEqual(contextualBackLink(go("/cont/locatii", go("/cont/locatii/nou"), "replace")), homeBack);
});

test("preparing a navigation cannot modify the origin's back button or history entry", () => {
  const app = harness("/cont/mesaje");
  app.navigate(conversation);
  const before = structuredClone(app.current());
  app.prepare(appointment);
  app.refresh();
  assert.deepEqual(app.current(), before);
  assert.equal(contextualBackLink(app.snapshot()).href, "/cont/mesaje");
  app.traverse(-1);
  app.navigate(appointment);
  assert.equal(contextualBackLink(app.snapshot()).href, "/cont/mesaje");
});

test("latest navigation wins and a redirect cannot inherit an unrelated pending destination", () => {
  const app = harness("/cont/mesaje");
  app.prepare(appointment);
  app.navigate(profile);
  assert.equal(contextualBackLink(app.snapshot()).href, "/cont/mesaje");
  const redirected = harness(profile);
  redirected.prepare(appointment);
  redirected.bridge.replace({ nextRouter: "preserved" }, "/autentificare");
  redirected.refresh();
  assert.equal(redirected.snapshot(), null);
  redirected.bridge.replace({ nextRouter: "preserved" }, appointment);
  redirected.refresh();
  assert.deepEqual(contextualBackLink(redirected.snapshot()), homeBack);
});

test("history state is validated and unrelated Next.js history fields are preserved", () => {
  for (const trail of [["https://example.test"], ["//example.test"], ["/%5cexample.test"], ["/api/health"], [appointment], ["/cont", "/cont"], ["/resetare-parola?token=secret"], Array.from({ length: 9 }, (_, i) => `/p/${i}`), ["/" + "x".repeat(1025)]]) {
    assert.equal(readNavigationEntry({ href: appointment, trail }, appointment), null);
  }
  assert.equal(readNavigationEntry({ href: conversation, trail: [] }, appointment), null);
  assert.equal(readNavigationEntry(null, appointment), null);
  const app = harness();
  app.navigate(appointment);
  assert.equal(app.current().state.nextRouter, "preserved");
});

test("only UI filters enter history, never auth tokens, messages or email addresses", () => {
  const student = go(`${profile}?tratament=carii&oras=iasi&pagina=2&token=SECRET&email=private%40example.test&nota=private#recenzii`);
  const calendar = go(booking, student);
  assert.doesNotMatch(JSON.stringify(calendar), /SECRET|private|token|email|nota/);
  assert.equal(contextualBackLink(calendar).href, `${profile}?tratament=carii&oras=iasi&pagina=2#recenzii`);
  for (const href of ["https://example.test", "//example.test", "mailto:test@example.test", "/api/health", "/autentificare", "/resetare-parola?token=secret"]) assert.equal(navigationSource(href), null);
});

test("old navigation query parameters are removed without reading them as context", () => {
  const href = `${profile}?inapoi=%5B%22%2Fcont%22%5D&sursa=acasa&tratament=carii#recenzii`;
  const clean = `${profile}?tratament=carii#recenzii`;
  assert.equal(cleanNavigationHref(href), clean);
  const app = harness(href);
  assert.equal(app.current().href, clean);
  assert.deepEqual(contextualBackLink(app.snapshot()), homeBack);
  assert.equal(cleanNavigationHref("https://example.test/?inapoi=anything"), "https://example.test/?inapoi=anything");
});

test("long navigation stays bounded and future pages need no pair-specific rules", () => {
  let current = go("/cont/o-pagina-noua");
  assert.deepEqual(contextualBackLink(go(appointment, current)), { href: current.href, label: "Înapoi" });
  for (let i = 0; i < 50; i++) {
    const previous = current.href;
    current = go(`/cont/programari/test-${i}`, current);
    assert.equal(contextualBackLink(current).href, previous);
    assert.ok(current.trail.length <= 8);
  }
});
