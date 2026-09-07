import assert from "node:assert/strict";
import test from "node:test";

import { centeredAnchorMargin } from "./centered-anchor-margin";

test("mobile cards fit in the center of the visible area below the sticky header", () => {
  for (const viewportHeight of [640, 667, 740, 800, 844, 932]) {
    for (const targetHeight of [300, 400, 520]) {
      const headerHeight = 72;
      const scrollPaddingTop = headerHeight + 16;
      const margin = centeredAnchorMargin({ viewportHeight, targetHeight, headerHeight, scrollPaddingTop });
      const cardTop = scrollPaddingTop + margin;
      assert.equal(cardTop + targetHeight / 2, headerHeight + (viewportHeight - headerHeight) / 2);
      assert.ok(cardTop >= scrollPaddingTop);
      assert.ok(cardTop + targetHeight <= viewportHeight - 16);
    }
  }
});

test("cards taller than a short or landscape viewport keep their beginning below the header", () => {
  for (const viewportHeight of [320, 390, 480, 667]) {
    assert.equal(centeredAnchorMargin({ viewportHeight, targetHeight: 700, headerHeight: 72, scrollPaddingTop: 88 }), 0);
  }
});

test("tablet and desktop centering subtract existing scroll padding rather than doubling it", () => {
  const measurements = { viewportHeight: 900, targetHeight: 420, headerHeight: 80, scrollPaddingTop: 96 };
  const margin = centeredAnchorMargin(measurements);
  assert.equal(margin, 184);
  assert.equal(measurements.scrollPaddingTop + margin + measurements.targetHeight / 2, 490);
});

test("centering adapts to a changed visual viewport, card text wrapping and header size", () => {
  const initial = { viewportHeight: 844, targetHeight: 500, headerHeight: 72, scrollPaddingTop: 88 };
  assert.equal(centeredAnchorMargin(initial), 120);
  assert.equal(centeredAnchorMargin({ ...initial, viewportHeight: 744 }), 70);
  assert.equal(centeredAnchorMargin({ ...initial, targetHeight: 600 }), 70);
  assert.equal(centeredAnchorMargin({ ...initial, headerHeight: 80, scrollPaddingTop: 96 }), 116);
});

test("repeat navigation uses the same offset and boundary-size cards do not clip under the header", () => {
  const measurements = { viewportHeight: 800, targetHeight: 696, headerHeight: 72, scrollPaddingTop: 88 };
  assert.equal(centeredAnchorMargin(measurements), 0);
  assert.equal(centeredAnchorMargin(measurements), centeredAnchorMargin({ ...measurements }));
});
