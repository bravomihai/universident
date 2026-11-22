import assert from "node:assert/strict";
import test from "node:test";
import { MAX_JSON_REQUEST_BYTES, readJsonRequest, readRequestBytes, RequestBodyTooLargeError } from "./request-body";

function streamedRequest(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[reads++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request("http://localhost/audit", {
    method: "POST", body, headers, duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, reads: () => reads, cancelled: () => cancelled };
}

test("bounded bodies preserve split UTF-8 and accept the exact byte boundary", async () => {
  const source = new TextEncoder().encode("ă😀");
  const fixture = streamedRequest([source.slice(0, 1), source.slice(1, 4), source.slice(4)]);
  assert.equal(new TextDecoder().decode(await readRequestBytes(fixture.request, source.length)), "ă😀");
  assert.equal(fixture.cancelled(), false);
});

test("missing or understated Content-Length cannot bypass the stream limit", async () => {
  const cases: HeadersInit[] = [{}, { "Content-Length": "1" }];
  for (const headers of cases) {
    const fixture = streamedRequest([new Uint8Array(3), new Uint8Array(3), new Uint8Array(3)], headers);
    await assert.rejects(readRequestBytes(fixture.request, 5), RequestBodyTooLargeError);
    assert.equal(fixture.reads(), 2);
    assert.equal(fixture.cancelled(), true);
  }
});

test("a declared oversized body is rejected before reading any chunks", async () => {
  const fixture = streamedRequest([new Uint8Array(1)], { "Content-Length": "100" });
  await assert.rejects(readRequestBytes(fixture.request, 5), RequestBodyTooLargeError);
  assert.equal(fixture.reads(), 0);
  assert.equal(fixture.cancelled(), true);
});

test("body size is measured in bytes rather than characters", async () => {
  const fixture = streamedRequest([new TextEncoder().encode("ăă")]);
  await assert.rejects(readRequestBytes(fixture.request, 3), RequestBodyTooLargeError);
});

test("valid JSON keeps optional values, arrays, booleans and Romanian text unchanged", async () => {
  const value = { name: "Ștefan Ionescu", bio: null, ids: ["first", "second"], isPublished: false };
  const result = await readJsonRequest(new Request("http://localhost/profile", {
    method: "PUT", body: JSON.stringify(value), headers: { "Content-Type": "application/json" },
  }));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, value);
});

test("notification acknowledgements with 1000 actual-length identifiers fit the JSON limit", async () => {
  const value = { notificationIds: Array.from({ length: 1000 }, (_, i) => `c${String(i).padStart(24, "0")}`) };
  const result = await readJsonRequest(new Request("http://localhost/notifications", {
    method: "POST", body: JSON.stringify(value),
  }));
  assert.equal(result.ok, true);
});

test("large JSON gets 413 while malformed, missing or failed bodies get a generic 400", async () => {
  const oversized = streamedRequest([new Uint8Array(MAX_JSON_REQUEST_BYTES + 1)]);
  const large = await readJsonRequest(oversized.request);
  assert.equal(large.ok, false);
  if (!large.ok) {
    assert.equal(large.response.status, 413);
    assert.equal(large.response.headers.get("cache-control"), "no-store");
  }
  const failing = new Request("http://localhost/json", {
    method: "POST",
    body: new ReadableStream({ start(controller) { controller.error(new Error("private-provider-details")); } }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  for (const request of [new Request("http://localhost/json", { method: "POST", body: "{" }), new Request("http://localhost/json", { method: "POST" }), failing]) {
    const result = await readJsonRequest(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
      assert.doesNotMatch(await result.response.text(), /private-provider-details/);
    }
  }
});
