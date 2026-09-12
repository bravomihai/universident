import assert from "node:assert/strict";
import test from "node:test";
import { chatSlugWhere, isChatSlug, withChatSlugRetry } from "./slug";

test("conversation identifiers contain exactly twelve lowercase hexadecimal characters", () => {
  assert.equal(isChatSlug("a1b2c3d4e5f6"), true);
  for (const slug of ["a1b2c3d4e5f", "a1b2c3d4e5f67", "A1B2C3D4E5F6", "g1b2c3d4e5f6", "../mesaje"]) assert.equal(isChatSlug(slug), false);
  assert.deepEqual(chatSlugWhere("a1b2c3d4e5f6"), { chatSlug: "a1b2c3d4e5f6" });
  assert.deepEqual(chatSlugWhere("consultatie-2026-09-12-abcd1234"), { routeSlug: "consultatie-2026-09-12-abcd1234" });
});

test("a conversation-slug collision retries the transaction without retrying unrelated conflicts", async () => {
  let attempts = 0;
  const collision = { code: "P2002", meta: { target: ["chatSlug"] } };
  assert.equal(await withChatSlugRetry(async () => { if (++attempts === 1) throw collision; return "saved"; }), "saved");
  assert.equal(attempts, 2);
  attempts = 0;
  const other = { code: "P2002", meta: { target: ["idempotencyKeyHash"] } };
  await assert.rejects(withChatSlugRetry(async () => { attempts++; throw other; }), (error) => error === other);
  assert.equal(attempts, 1);
  attempts = 0;
  await assert.rejects(withChatSlugRetry(async () => { attempts++; throw collision; }), (error) => error === collision);
  assert.equal(attempts, 3);
  attempts = 0;
  const adapterCollision = { code: "P2002", meta: { driverAdapterError: { cause: { constraint: { fields: ['"chatSlug"'] } } } } };
  assert.equal(await withChatSlugRetry(async () => { if (++attempts === 1) throw adapterCollision; return "saved"; }), "saved");
  assert.equal(attempts, 2);
});
