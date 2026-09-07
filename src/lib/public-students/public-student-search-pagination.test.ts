import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicStudentPagination } from "@/components/public-students/public-student-pagination";
import { publicStudentPaginationItems, publicStudentSearchHref } from "./public-student-search-pagination";

test("short search pagination shows every page without gaps", () => {
  assert.deepEqual(publicStudentPaginationItems(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(publicStudentPaginationItems(2, 4, true), [1, 2, 3, 4]);
  assert.deepEqual(publicStudentPaginationItems(1, 1), [1]);
  assert.deepEqual(publicStudentPaginationItems(1, 0), []);
});

test("desktop pagination shows the start, end and current-page neighbours", () => {
  assert.deepEqual(publicStudentPaginationItems(1, 20), [1, 2, 3, 4, 5, "gap-5", 20]);
  assert.deepEqual(publicStudentPaginationItems(10, 20), [1, "gap-1", 9, 10, 11, "gap-11", 20]);
  assert.deepEqual(publicStudentPaginationItems(20, 20), [1, "gap-1", 16, 17, 18, 19, 20]);
});

test("phone pagination keeps the first, current and last pages in a compact range", () => {
  assert.deepEqual(publicStudentPaginationItems(1, 20, true), [1, 2, "gap-2", 20]);
  assert.deepEqual(publicStudentPaginationItems(10, 20, true), [1, "gap-1", 10, "gap-10", 20]);
  assert.deepEqual(publicStudentPaginationItems(20, 20, true), [1, "gap-1", 19, 20]);
});

test("all pagination ranges have unique ordered keys and preserve the selected page", () => {
  for (const total of [1, 2, 4, 5, 7, 8, 9, 20, 100]) {
    for (let current = 1; current <= total; current++) {
      for (const compact of [false, true]) {
        const items = publicStudentPaginationItems(current, total, compact);
        const pages = items.filter((item): item is number => typeof item === "number");
        assert.equal(new Set(items).size, items.length);
        assert.equal(pages[0], 1);
        assert.equal(pages.at(-1), total);
        assert.ok(pages.includes(current));
        assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
        assert.ok(items.length <= (compact ? 5 : 7));
        if (compact) {
          const width = (pages.length + 2) * 44 + (items.length - pages.length) * 20 + (items.length + 1) * 4;
          assert.ok(width <= 288, `Pagination at ${current}/${total} exceeds a 320px viewport with 16px gutters`);
        }
      }
    }
  }
});

test("out-of-range or invalid page inputs cannot create invalid pagination targets", () => {
  for (const current of [-10, 0, NaN, Infinity, 1.5, 200]) {
    const items = publicStudentPaginationItems(current, 10);
    assert.ok(items.every((item) => typeof item !== "number" || (Number.isInteger(item) && item >= 1 && item <= 10)));
  }
  for (const total of [-1, NaN, Infinity, 1.5]) assert.deepEqual(publicStudentPaginationItems(1, total), []);
});

test("pagination links preserve treatment and city and omit the first page parameter", () => {
  assert.equal(publicStudentSearchHref("afectiuni-gingivale", "cluj-napoca"), "/studenti?tratament=afectiuni-gingivale&oras=cluj-napoca");
  for (const page of [1, 2, 10]) {
    const url = new URL(publicStudentSearchHref("tratament & special", "oraș/centru", page), "https://example.test");
    assert.equal(url.pathname, "/studenti");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      tratament: "tratament & special", oras: "oraș/centru", ...(page > 1 ? { pagina: String(page) } : {}),
    });
  }
});

const props = { totalPages: 20, treatmentSlug: "afectiuni-gingivale", citySlug: "cluj-napoca" };
const render = (page: number) => renderToStaticMarkup(createElement(PublicStudentPagination, { ...props, page }));

test("pagination renders accessible current-page links and non-interactive gaps using shared controls", () => {
  const markup = render(10);
  assert.match(markup, /<nav aria-label="Paginarea rezultatelor"/);
  // One current link per responsive list; CSS displays only one list at a time.
  assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 2);
  assert.match(markup, /aria-label="Pagina 10, pagina curentă"/);
  for (const [currentLink] of markup.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)) {
    assert.match(currentLink, /data-variant="default"/);
  }
  assert.match(markup, /rel="prev" aria-label="Pagina anterioară"/);
  assert.match(markup, /rel="next" aria-label="Pagina următoare"/);
  assert.match(markup, /<span aria-hidden="true">…<\/span>/);
  assert.equal((markup.match(/<button/g) ?? []).length, 0);
  for (const match of markup.matchAll(/href="([^"]+)"/g)) {
    const url = new URL(match[1].replaceAll("&amp;", "&"), "https://example.test");
    assert.equal(url.searchParams.get("tratament"), props.treatmentSlug);
    assert.equal(url.searchParams.get("oras"), props.citySlug);
  }
});

test("previous and next controls are disabled at the respective search boundaries", () => {
  assert.match(render(1), /<button[^>]*disabled=""[^>]*aria-label="Pagina anterioară"/);
  assert.doesNotMatch(render(1), /rel="prev"/);
  assert.match(render(20), /<button[^>]*disabled=""[^>]*aria-label="Pagina următoare"/);
  assert.doesNotMatch(render(20), /rel="next"/);
});

test("one-page and empty search results do not render redundant pagination", () => {
  for (const totalPages of [0, 1]) {
    assert.equal(renderToStaticMarkup(createElement(PublicStudentPagination, { ...props, page: 1, totalPages })), "");
  }
});
