import assert from "node:assert/strict";
import test from "node:test";

import { runSeriesOperationsIsolated } from "@/lib/availability/series-isolation";

test("one invalid series does not stop later public materialization candidates", async () => {
  const completed: string[] = [];
  const failed: string[] = [];
  await runSeriesOperationsIsolated(
    ["invalid", "healthy"],
    async (seriesId) => {
      if (seriesId === "invalid") throw new Error("unexpected invalid rule");
      completed.push(seriesId);
    },
    (seriesId) => failed.push(seriesId),
  );
  assert.deepEqual(failed, ["invalid"]);
  assert.deepEqual(completed, ["healthy"]);
});
