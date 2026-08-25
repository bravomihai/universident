import assert from "node:assert/strict";
import test from "node:test";

import {
  SchedulingTemporarilyUnavailableError,
  withP2034Retry,
} from "@/lib/scheduling/transaction";

test("retries P2034 with bounded backoff and succeeds", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await withP2034Retry(async () => {
    attempts += 1;
    if (attempts < 3) throw { code: "P2034" };
    return "ok";
  }, {
    sleep: async (milliseconds) => { delays.push(milliseconds); },
    random: () => 0,
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [25, 50]);
});

test("does not retry business errors and controls exhausted P2034", async () => {
  let businessAttempts = 0;
  await assert.rejects(
    withP2034Retry(async () => {
      businessAttempts += 1;
      throw new Error("business");
    }, { sleep: async () => undefined }),
    /business/,
  );
  assert.equal(businessAttempts, 1);

  await assert.rejects(
    withP2034Retry(async () => { throw { code: "P2034" }; }, {
      maxAttempts: 2,
      sleep: async () => undefined,
      random: () => 0,
    }),
    SchedulingTemporarilyUnavailableError,
  );
});
