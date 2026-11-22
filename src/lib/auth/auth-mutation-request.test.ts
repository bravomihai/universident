import assert from "node:assert/strict";
import test from "node:test";
import { MAX_JSON_REQUEST_BYTES } from "@/lib/api/request-body";
import { prepareAuthMutationRequest } from "./auth-mutation-request";

test("the generic profile mutation and wrapper-only auth paths cannot be called directly", async () => {
  for (const path of ["update-user", "update-user/", "%75pdate-user", "request-password-reset", "reset-password", "change-email", "verify-password"]) {
    const result = await prepareAuthMutationRequest(new Request(`http://localhost/api/auth/${path}`, {
      method: "POST", body: JSON.stringify({ name: "unvalidated" }),
    }));
    assert.equal(result.ok, false, path);
    if (!result.ok) assert.equal(result.response.status, 404, path);
  }
});

test("signup, login, password changes and session operations retain bodies and security headers", async () => {
  for (const path of ["sign-up/email", "sign-in/email", "change-password", "sign-out", "revoke-sessions", "revoke-other-sessions"]) {
    const body = JSON.stringify({ name: "Ștefan", password: "synthetic-test-password", revokeOtherSessions: true });
    const result = await prepareAuthMutationRequest(new Request(`http://localhost/api/auth/${path}`, {
      method: "POST", body,
      headers: { "Content-Type": "application/json", Cookie: "session=synthetic", Origin: "http://localhost", "X-Forwarded-For": "192.0.2.1" },
    }));
    assert.equal(result.ok, true, path);
    if (result.ok) {
      assert.equal(await result.request.text(), body);
      assert.equal(result.request.headers.get("cookie"), "session=synthetic");
      assert.equal(result.request.headers.get("origin"), "http://localhost");
      assert.equal(result.request.headers.get("x-forwarded-for"), "192.0.2.1");
      assert.equal(result.request.headers.get("content-type"), "application/json");
    }
  }
});

test("body-less sign-out remains valid and oversized auth input is rejected", async () => {
  const empty = await prepareAuthMutationRequest(new Request("http://localhost/api/auth/sign-out", { method: "POST" }));
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(await empty.request.text(), "");
  const large = await prepareAuthMutationRequest(new Request("http://localhost/api/auth/sign-up/email", {
    method: "POST", body: "x".repeat(MAX_JSON_REQUEST_BYTES + 1),
  }));
  assert.equal(large.ok, false);
  if (!large.ok) assert.equal(large.response.status, 413);
});
