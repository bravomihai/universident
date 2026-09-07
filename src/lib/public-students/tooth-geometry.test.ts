import assert from "node:assert/strict";
import test from "node:test";
import { createToothGeometry, toothDistance } from "@/components/home/tooth-geometry";

test("decorative tooth has a connected crown and two separated smooth roots", () => {
  assert.ok(toothDistance(0, 0.4, 0) < 0);
  assert.ok(toothDistance(0.49, -1.2, 0) < 0);
  assert.ok(toothDistance(-0.49, -1.2, 0) < 0);
  assert.ok(toothDistance(0, -1.2, 0) > 0);
  assert.ok(toothDistance(1.9, 1.9, 1.9) > 0);
  for (const y of [-1.2, -0.5, 0, 0.5, 1.1]) {
    assert.ok(Math.abs(toothDistance(0.4, y, 0.2) - toothDistance(-0.4, y, 0.2)) < 0.00001);
  }
});

test("production tooth mesh has finite positions, smooth normals and bounded geometry", () => {
  const geometry = createToothGeometry();
  try {
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    assert.ok(positions.count > 1000);
    assert.equal(positions.count % 3, 0);
    assert.equal(normals.count, positions.count);
    assert.ok(Array.from(positions.array).every((value) => Number.isFinite(value) && Math.abs(value) < 2));
    assert.ok(Array.from(normals.array).every(Number.isFinite));
    assert.ok(geometry.boundingSphere && geometry.boundingSphere.radius > 1 && geometry.boundingSphere.radius < 2);
  } finally {
    geometry.dispose();
  }
});
