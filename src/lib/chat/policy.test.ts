import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_GRACE_MS, chatState, nextEmailDueAt, parseChatMessage, safeChatReturnTo } from "./policy";

const ended = new Date("2026-10-24T12:00:00Z");
test("pending and never-confirmed terminal requests cannot open chat", () => {
  for (const status of ["PENDING", "REJECTED", "EXPIRED", "SUPERSEDED", "CANCELLED_BY_PATIENT"]) {
    assert.equal(chatState({ status, confirmedAt: null, statusChangedAt: ended }).available, false);
    assert.equal(chatState({ status, confirmedAt: null, statusChangedAt: ended }).canSend, false);
  }
});
test("confirmed chat stays active until appointment outcome, including overdue appointments", () => {
  assert.deepEqual(chatState({ status: "CONFIRMED", confirmedAt: ended, statusChangedAt: ended }, new Date("2027-01-01")), { available: true, past: false, canSend: true, closesAt: null });
});
test("all previously-confirmed terminal chats allow exactly seven elapsed days across DST", () => {
  for (const status of ["COMPLETED", "CANCELLED_BY_PATIENT", "CANCELLED_BY_STUDENT", "NO_SHOW"]) {
    const appointment = { status, confirmedAt: ended, statusChangedAt: ended };
    assert.equal(chatState(appointment, ended).past, true);
    assert.equal(chatState(appointment, new Date(ended.getTime() + CHAT_GRACE_MS - 1)).canSend, true);
    assert.equal(chatState(appointment, new Date(ended.getTime() + CHAT_GRACE_MS)).canSend, false);
    assert.equal(chatState(appointment, new Date("2027-01-01")).available, true);
  }
});
test("email batches wait three minutes and respect recipient cooldown", () => {
  assert.equal(nextEmailDueAt(ended, null).getTime(), ended.getTime() + 3 * 60_000);
  assert.equal(nextEmailDueAt(ended, ended).getTime(), ended.getTime() + 15 * 60_000);
});
test("message parsing rejects blank, oversized, malformed IDs and control characters", () => {
  const clientId = "a-valid-client-id-00001";
  for (const text of ["  ", "x".repeat(2001), "hello\u0000"]) assert.equal(parseChatMessage({ text, clientId }), null);
  assert.equal(parseChatMessage({ text: "Salut", clientId: "small" }), null);
  assert.deepEqual(parseChatMessage({ text: "  Bună!\nMulțumesc.  ", clientId }), { text: "Bună!\nMulțumesc.", clientId });
});
test("email return paths cannot redirect off-site or to arbitrary private routes", () => {
  for (const path of ["https://evil.example", "//evil.example", "/\\evil", "/cont/mesaje/%2f%2fevil", "/cont/mesaje/../securitate", "/cont/securitate", ["/cont/mesaje"]]) assert.equal(safeChatReturnTo(path), null);
  assert.equal(safeChatReturnTo("/cont/mesaje/programare-123"), "/cont/mesaje/programare-123");
});
