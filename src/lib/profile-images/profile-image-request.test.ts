import assert from "node:assert/strict";
import test from "node:test";
import { readProfileImageRequest } from "./profile-image-request";
import { MAX_PROFILE_IMAGE_BYTES } from "@/lib/student-profile/profile-image-validation";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAgElEQVR4nNXOQREAIAzAsFJdyEETehGxB9coyNrnUiZxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEufvwNQDrxQBtnGdcQcAAAAASUVORK5CYII=", "base64");

function upload(data: Uint8Array, contentType = "image/png", extraField = false) {
  const form = new FormData();
  form.set("image", new Blob([Uint8Array.from(data).buffer], { type: contentType }), "profile.png");
  if (extraField) form.set("userId", "other-owner");
  return new Request("http://localhost/profile/image", { method: "PUT", body: form });
}

test("a valid photo keeps its original bytes and is detected independently of the supplied MIME", async () => {
  for (const type of ["image/png", "application/octet-stream"]) {
    const result = await readProfileImageRequest(upload(png, type));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "image/png");
      assert.equal(result.width, 64);
      assert.equal(result.height, 64);
      assert.deepEqual(Buffer.from(result.data), png);
    }
  }
});

test("the supported 2 MB photo boundary is retained with multipart overhead", async () => {
  const bytes = new Uint8Array(MAX_PROFILE_IMAGE_BYTES);
  bytes.set(png);
  const result = await readProfileImageRequest(upload(bytes));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.byteLength, MAX_PROFILE_IMAGE_BYTES);
});

test("a chunked oversized upload is cancelled before the whole file is read", async () => {
  const original = upload(new Uint8Array(3 * 1024 * 1024));
  const all = new Uint8Array(await original.arrayBuffer());
  let consumed = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (consumed === all.length) { controller.close(); return; }
      const next = Math.min(consumed + 65536, all.length);
      controller.enqueue(all.slice(consumed, next));
      consumed = next;
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request(original.url, {
    method: "PUT", headers: original.headers, body, duplex: "half",
  } as RequestInit & { duplex: "half" });
  assert.equal(request.headers.get("content-length"), null);
  const result = await readProfileImageRequest(request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 413);
    assert.equal((await result.response.json()).code, "IMAGE_TOO_LARGE");
  }
  assert.equal(cancelled, true);
  assert.ok(consumed < all.length);
  assert.ok(consumed <= MAX_PROFILE_IMAGE_BYTES + 256 * 1024 + 65536);
});

test("invalid, duplicate and oversized photo inputs retain their validation errors", async () => {
  const duplicate = new FormData();
  duplicate.append("image", new Blob([png]), "one.png");
  duplicate.append("image", new Blob([png]), "two.png");
  const cases = [
    { request: upload(new TextEncoder().encode("not a real PNG")), status: 400 },
    { request: upload(new Uint8Array(MAX_PROFILE_IMAGE_BYTES + 1)), status: 413 },
    { request: upload(png, "image/png", true), status: 400 },
    { request: new Request("http://localhost/image", { method: "PUT", body: duplicate }), status: 400 },
    { request: new Request("http://localhost/image", { method: "PUT", body: "{}", headers: { "Content-Type": "application/json" } }), status: 415 },
  ];
  for (const { request, status } of cases) {
    const result = await readProfileImageRequest(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, status);
  }
});
