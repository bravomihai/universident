import assert from "node:assert/strict";
import test from "node:test";

import { parseAccountName } from "@/lib/account/account-name";

test("account name is trimmed and internal whitespace is normalized", () => {
  const result = parseAccountName("  Ana   Maria  Popescu ");

  assert.deepEqual(result, { ok: true, data: "Ana Maria Popescu" });
});

test("account name rejects missing, short, and overly long values", () => {
  assert.equal(parseAccountName(null).ok, false);
  assert.equal(parseAccountName("A").ok, false);
  assert.equal(parseAccountName("a".repeat(101)).ok, false);
});
