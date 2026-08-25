import assert from "node:assert/strict";
import test from "node:test";

import {
  availabilityRootLockKey,
  normalizeSchedulingLockKeys,
} from "@/lib/scheduling/locks";

test("uses one deterministic lock order and one root for recurring slots", () => {
  assert.deepEqual(
    normalizeSchedulingLockKeys(["series:b", "resource:treatment:x", "series:a", "series:b"]),
    ["resource:treatment:x", "series:a", "series:b"],
  );
  assert.equal(availabilityRootLockKey({ id: "slot-1", seriesId: "series-1" }), "series:series-1");
  assert.equal(availabilityRootLockKey({ id: "slot-1", seriesId: null }), "slot:slot-1");
});
