import assert from "node:assert/strict";
import test from "node:test";
import { parseEmptyJsonRequestBody } from "./empty-json-request-body";

test("resource restoration retains empty, whitespace and empty-object requests", async () => {
  for (const body of [undefined, "", "  \n", "{}", " { } "]) {
    const result = await parseEmptyJsonRequestBody(new Request("http://localhost/restore", { method: "POST", body }));
    assert.equal(result.ok, true);
  }
});

test("resource restoration rejects extra fields and stops oversized bodies", async () => {
  for (const [body, status] of [["{", 400], ["[]", 400], ['{"id":"other-owner"}', 400], [" ".repeat(1025), 413]] as const) {
    const result = await parseEmptyJsonRequestBody(new Request("http://localhost/restore", { method: "POST", body }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, status);
  }
});
