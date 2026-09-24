import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import manifest from "@/app/manifest";
import { BrandFaviconLinks } from "@/components/layout/brand-favicon-links";
import { brandAssets, brandThemes, faviconLinkId, faviconMedia, shortcutBrandAssets } from "./brand-assets";

test("brand files have the expected dimensions, transparency and opaque shortcut variants", () => {
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
  for (const icon of [shortcutBrandAssets.apple, ...shortcutBrandAssets.icons]) {
    const png = readFileSync(new URL(`../../../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.deepEqual(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      icon.sizes.split("x").map(Number),
    );
    assert.equal(png[25], 2, `${icon.src} must have an opaque RGB background`);
  }
  assert.deepEqual(
    readFileSync(new URL("../../../public/apple-touch-icon.png", import.meta.url)),
    readFileSync(new URL(`../../../public${shortcutBrandAssets.apple.src}`, import.meta.url)),
  );
  const ico = readFileSync(new URL("../../../public/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    assert.equal(ico[6 + index * 16], size);
    assert.equal(ico[7 + index * 16], size);
    const offset = ico.readUInt32LE(6 + index * 16 + 12);
    assert.equal(ico.subarray(offset, offset + 8).toString("hex"), "89504e470d0a1a0a");
  }
});

test("server markup exposes two themed favicons and one unconditional Apple icon", () => {
  const markup = renderToStaticMarkup(createElement(BrandFaviconLinks));
  assert.equal((markup.match(/<link\s/g) ?? []).length, 3);
  for (const theme of brandThemes) {
    assert.ok(markup.includes(`id="${faviconLinkId(theme)}"`));
    assert.ok(markup.includes(`href="${brandAssets[theme].favicon}"`));
    assert.ok(markup.includes(`media="(prefers-color-scheme: ${theme})"`));
  }
  const appleLinks = markup.match(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g) ?? [];
  assert.equal(appleLinks.length, 1);
  assert.ok(appleLinks[0].includes(`href="${shortcutBrandAssets.apple.src}"`));
  assert.match(appleLinks[0], /sizes="180x180"/);
  assert.doesNotMatch(appleLinks[0], /media=/);
  assert.deepEqual(
    manifest().icons?.map(({ src, sizes, type }) => ({ src, sizes, type })),
    shortcutBrandAssets.icons,
  );
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
