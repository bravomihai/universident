import assert from "node:assert/strict";
import test from "node:test";
import { moderateChatMessage, parseModerationVerdict, MODERATION_PROMPT } from "./moderation";

test("moderation rejects inconsistent decisions", () => {
  for (const value of [{ decision: "ALLOW", reason: "HATE" }, { decision: "BLOCK", reason: "NONE" }, { decision: "MAYBE", reason: "NONE" }, {}]) assert.equal(parseModerationVerdict(value), null);
});

test("moderation treats messages as data and disables Responses persistence", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  try {
    const bodies: Record<string, unknown>[] = [];
    const request = (async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body)); bodies.push(body);
      return Response.json(bodies.length === 1
        ? { results: [{ categories: { harassment: false, hate: false, violence: true } }] }
        : { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ decision: "ALLOW", reason: "NONE" }) }] }] });
    }) as typeof fetch;
    assert.deepEqual(await moderateChatMessage("Mă doare după extracție și sângerează.", request), { decision: "ALLOW", reason: "NONE" });
    assert.equal(bodies[1].store, false);
    assert.equal(bodies[1].instructions, MODERATION_PROMPT);
    assert.equal("previous_response_id" in bodies[1], false);
    assert.equal(JSON.stringify(bodies).includes("recipient"), false);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test("provider failures, refusals and truncated results fail closed without leaking provider details", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  try {
    for (const mode of ["network", "quota", "refusal", "truncated", "malformed"]) {
      let calls = 0;
      const request = (async () => {
        calls++;
        if (mode === "network") throw new Error("SECRET_PROVIDER_DETAIL");
        if (mode === "quota") return Response.json({ error: "SECRET_PROVIDER_DETAIL" }, { status: 429 });
        if (calls === 1) return Response.json({ results: [{ categories: { harassment: false, hate: false } }] });
        return Response.json({ status: mode === "truncated" ? "incomplete" : "completed", output: [{ type: "message", content: [{ type: mode === "refusal" ? "refusal" : "output_text", text: "invalid JSON" }] }] });
      }) as typeof fetch;
      await assert.rejects(moderateChatMessage("Salut", request), (error: unknown) => error instanceof Error && "code" in error && error.code === "MODERATION_UNAVAILABLE" && !error.message.includes("SECRET_PROVIDER_DETAIL"));
    }
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
