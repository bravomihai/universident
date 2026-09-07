import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandFaviconLinks } from "@/components/layout/brand-favicon-links";
import { brandAssets, brandThemes, faviconLinkId, faviconMedia } from "./brand-assets";

test("all six brand files are RGBA PNGs with the expected paired dimensions", () => {
  const dimensions = { header: [1600, 320], logo: [1600, 1100], favicon: [512, 512] };
  for (const theme of brandThemes) {
    for (const kind of ["header", "logo", "favicon"] as const) {
      const path = new URL(`../../../public${brandAssets[theme][kind]}`, import.meta.url);
      const png = readFileSync(path);
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(png.subarray(12, 16).toString(), "IHDR");
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], dimensions[kind]);
      assert.equal(png[25], 6, `${kind}/${theme} must support real transparency`);
    }
  }
});

test("server markup offers exactly two system-aware branded icons without the default favicon", () => {
  const markup = renderToStaticMarkup(createElement(BrandFaviconLinks));
  assert.equal((markup.match(/<link\s/g) ?? []).length, 2);
  for (const theme of brandThemes) {
    assert.ok(markup.includes(`id="${faviconLinkId(theme)}"`));
    assert.ok(markup.includes(`href="${brandAssets[theme].favicon}"`));
    assert.ok(markup.includes(`media="(prefers-color-scheme: ${theme})"`));
  }
  assert.match(markup, /sizes="512x512"/);
  assert.doesNotMatch(markup, /favicon\.ico/);
  assert.equal(existsSync(fileURLToPath(new URL("../../app/favicon.ico", import.meta.url))), false);
});

test("manual light and dark selections enable only the matching favicon", () => {
  for (const active of brandThemes) {
    for (const variant of brandThemes) {
      assert.equal(faviconMedia(variant, active), variant === active ? "all" : "not all");
    }
  }
});

test("unresolved themes preserve the browser system preference before hydration", () => {
  for (const theme of brandThemes) {
    for (const unresolved of [undefined, "system", "unknown"]) {
      assert.equal(faviconMedia(theme, unresolved), `(prefers-color-scheme: ${theme})`);
    }
  }
});

test("repeated theme changes retain two stable icon identities without duplicates", () => {
  const ids = brandThemes.map(faviconLinkId);
  assert.equal(new Set(ids).size, 2);
  for (const resolved of ["dark", "light", "dark", "light"]) {
    assert.deepEqual(brandThemes.map(faviconLinkId), ids);
    assert.equal(brandThemes.filter((variant) => faviconMedia(variant, resolved) === "all").length, 1);
  }
});
