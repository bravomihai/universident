import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { Client } from "pg";
import { hashPassword } from "better-auth/crypto";

// Always create a fresh local database. Never run fixtures against the configured database.
const source = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("LOCAL_DATABASE_REQUIRED");
const databaseName = `universident_chat_test_${randomBytes(6).toString("hex")}`;
const adminUrl = new URL(source); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${databaseName}"`);
const testUrl = new URL(source); testUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = testUrl.toString();
process.env.BETTER_AUTH_URL = "http://localhost:3100";
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
process.env.CHAT_WORKER_SECRET = randomBytes(32).toString("hex");
process.env.RESEND_API_KEY = "test-only-no-external-email";
process.env.EMAIL_FROM = "Universident <no-reply@example.invalid>";
process.env.OPENAI_API_KEY = "";
let db: Awaited<typeof import("../src/lib/prisma")>["prisma"] | undefined;
let preserve = false;
try {
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  if (migrate.status !== 0) throw new Error(`TEST_MIGRATIONS_FAILED: ${migrate.stderr}`);
  db = (await import("../src/lib/prisma")).prisma;
  const { sendChatMessage, getChatPage, listChatConversations, acknowledgeChatMessages, unreadChatCount } = await import("../src/lib/chat/service");
  const { processChatEmails, chatEmailContent, getChatEmailQueueStatus } = await import("../src/lib/chat/email-worker");
  const { ChatError } = await import("../src/lib/chat/errors");
  const { withChatSlugRetry } = await import("../src/lib/chat/slug");
  const allow = async () => ({ decision: "ALLOW" as const, reason: "NONE" as const });
  const block = async () => ({ decision: "BLOCK" as const, reason: "HARASSMENT" as const });
  const testPassword = randomBytes(20).toString("hex");
  const passwordHash = await hashPassword(testPassword);
  const patient = await db.user.create({ data: { id: randomUUID(), email: "patient@example.invalid", name: "Pacient Test Chat", role: "PATIENT", emailVerified: true } });
  const student = await db.user.create({ data: { id: randomUUID(), email: "student@example.invalid", name: "Student Test Chat", role: "STUDENT", emailVerified: true } });
  const outsider = await db.user.create({ data: { id: randomUUID(), email: "outsider@example.invalid", name: "Alt Pacient", role: "PATIENT", emailVerified: true } });
  for (const user of [patient, student, outsider]) await db.account.create({ data: { id: randomUUID(), accountId: user.id, userId: user.id, providerId: "credential", password: passwordHash } });
  const pp = await db.patientProfile.create({ data: { userId: patient.id, profileSlug: "pacient-chat-test", dateOfBirth: new Date("1990-01-01") } });
  const sp = await db.studentProfile.create({ data: { userId: student.id, publicSlug: "student-chat-test", university: "UMFCD", studyYear: 4 } });
  const city = await db.city.create({ data: { name: "Oraș test", slug: "oras-test" } });
  const treatment = await db.treatment.create({ data: { name: "Consultație de test", slug: "consultatie-test", description: "Test local" } });
  const location = await db.studentLocation.create({ data: { studentProfileId: sp.id, cityId: city.id, routeKey: "abc123", name: "Cabinet Test", address: "Adresă fictivă" } });
  const supervisor = await db.studentSupervisor.create({ data: { studentProfileId: sp.id, fullName: "Coordonator Test" } });
  const st = await db.studentTreatment.create({ data: { studentProfileId: sp.id, treatmentId: treatment.id, durationMinutes: 30 } });
  const start = new Date(Date.now() + 2 * 86_400_000); start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 4 * 3_600_000);
  const slot = await db.studentAvailabilitySlot.create({ data: { studentProfileId: sp.id, studentLocationId: location.id, originalStartsAt: start, startsAt: start, endsAt: end } });
  const offering = await db.studentAvailabilitySlotOffering.create({ data: { slotId: slot.id, studentProfileId: sp.id, studentTreatmentId: st.id, supervisorId: supervisor.id } });
  const appointmentData = {
    patientProfileId: pp.id, studentProfileId: sp.id, studentAvailabilitySlotId: slot.id, studentAvailabilitySlotOfferingId: offering.id,
    patientAgeAtAppointment: 36, patientNameSnapshot: patient.name, studentNameSnapshot: student.name,
    treatmentNameSnapshot: treatment.name, locationNameSnapshot: location.name, locationAddressSnapshot: location.address, supervisorNameSnapshot: supervisor.fullName,
  };
  const appointment = await db.appointment.create({ data: { ...appointmentData, routeSlug: "consultatie-chat-test", scheduledStartsAt: start, scheduledEndsAt: new Date(start.getTime() + 1_800_000), status: "CONFIRMED", confirmedAt: new Date() } });
  const pending = await db.appointment.create({ data: { ...appointmentData, routeSlug: "cerere-chat-test", scheduledStartsAt: new Date(start.getTime() + 3_600_000), scheduledEndsAt: new Date(start.getTime() + 5_400_000), pendingExpiresAt: new Date(Date.now() + 3_600_000), status: "PENDING" } });
  const slug = appointment.chatSlug;
  assert.match(slug, /^[0-9a-f]{12}$/);
  assert.match(pending.chatSlug, /^[0-9a-f]{12}$/);
  assert.notEqual(slug, pending.chatSlug, "each appointment has its own conversation identifier");
  let uniqueError: unknown;
  try { await db.appointment.update({ where: { id: pending.id }, data: { chatSlug: slug } }); }
  catch (error) { uniqueError = error; }
  assert.ok(uniqueError, "the database must reject duplicate conversation identifiers");
  let slugRetries = 0;
  assert.equal(await withChatSlugRetry(async () => { if (++slugRetries === 1) throw uniqueError; return true; }), true);
  assert.equal(slugRetries, 2, "the real Prisma collision shape must be retried");
  await assert.rejects(db.appointment.update({ where: { id: pending.id }, data: { chatSlug: "invalid-slug" } }));
  const input = (text: string) => ({ text, clientId: randomUUID() });
  const code = (expected: string) => (error: unknown) => error instanceof ChatError && error.code === expected;

  await assert.rejects(getChatPage(slug, outsider), code("NOT_FOUND"));
  await assert.rejects(sendChatMessage(pending.routeSlug, patient, input("Salut"), allow), code("NOT_FOUND"));
  await assert.rejects(getChatPage(pending.chatSlug, patient), code("NOT_FOUND"));
  await assert.rejects(getChatPage(slug, { id: student.id, role: "ADMIN" }), code("NOT_FOUND"));
  assert.equal((await listChatConversations(patient)).conversations.length, 1);
  assert.equal((await listChatConversations(patient)).conversations[0].slug, slug);
  assert.equal((await listChatConversations(patient, false, slug)).conversations.length, 0);
  assert.equal((await getChatPage(appointment.routeSlug, patient)).conversation.slug, slug, "legacy appointment links resolve to the canonical chat identifier");
  assert.equal((await getChatPage(slug, patient)).conversation.appointmentSlug, appointment.routeSlug);
  const firstInput = input("Bună ziua! Confirm programarea.");
  const first = await sendChatMessage(slug, patient, firstInput, allow);
  const repeated = await sendChatMessage(slug, patient, firstInput, async () => { throw new Error("Moderation must not run on a saved retry"); });
  assert.equal(first.id, repeated.id);
  await assert.rejects(sendChatMessage(slug, patient, { ...firstInput, text: "Alt mesaj" }, allow), code("IDEMPOTENCY_CONFLICT"));
  await assert.rejects(sendChatMessage(slug, patient, input("Mesaj simulat blocat"), block), code("MESSAGE_BLOCKED"));
  await assert.rejects(sendChatMessage(slug, patient, input("Mesaj cu serviciu indisponibil"), async () => { throw new ChatError("MODERATION_UNAVAILABLE", "Indisponibil", 503); }), code("MODERATION_UNAVAILABLE"));
  assert.equal(await db.chatMessage.count(), 1);
  assert.equal(await db.chatEmailBatch.count(), 1);
  assert.equal(await unreadChatCount(student), 1);
  assert.equal(await unreadChatCount(patient), 0);
  const serialized = JSON.stringify(await getChatPage(slug, student));
  for (const privateValue of [patient.email, student.email, patient.id, student.id, pp.id, sp.id]) assert.equal(serialized.includes(privateValue), false);
  await acknowledgeChatMessages(slug, patient, [first.id]);
  assert.equal((await db.chatMessage.findUniqueOrThrow({ where: { id: first.id } })).readAt, null);
  await assert.rejects(acknowledgeChatMessages(slug, outsider, [first.id]), code("NOT_FOUND"));
  await acknowledgeChatMessages(slug, student, [first.id]);
  assert.equal(await unreadChatCount(student), 0);
  let calls = 0;
  const received: { idempotencyKey: string; to: string; from: string; url: string }[] = [];
  const deliver = async (payload: typeof received[number]) => { calls++; received.push(payload); };
  const future = new Date(Date.now() + 185_000);
  await processChatEmails(deliver, future);
  assert.equal(calls, 0, "read messages must not generate email");
  const second = await sendChatMessage(slug, patient, input("Mai am o întrebare despre programare."), allow);
  const secondBatch = (await db.chatMessage.findUniqueOrThrow({ where: { id: second.id } })).emailBatchId!;
  await processChatEmails(async (payload) => { received.push(payload); throw new Error("simulated network failure"); }, future);
  const newDuringRetry = await sendChatMessage(slug, patient, input("Mulțumesc pentru ajutor."), allow);
  assert.notEqual((await db.chatMessage.findUniqueOrThrow({ where: { id: newDuringRetry.id } })).emailBatchId, secondBatch);
  const retryTime = new Date(future.getTime() + 65_000);
  await Promise.all([processChatEmails(deliver, retryTime), processChatEmails(deliver, retryTime)]);
  assert.equal(calls, 1, "concurrent workers must share a single lease");
  assert.deepEqual(received[0], received[1], "provider retries must use identical payloads and idempotency keys");
  await processChatEmails(deliver, new Date(retryTime.getTime() + 10 * 60_000));
  assert.equal(calls, 1, "cooldown must defer the next email batch");
  await processChatEmails(deliver, new Date(retryTime.getTime() + 16 * 60_000));
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(chatEmailContent(received[0].url)).includes("Mai am o întrebare"), false);
  assert.equal(new URL(received[0].url).pathname, `/cont/mesaje/${slug}`);

  // A read first message must not make a newer unread message eligible too early.
  const olderIncoming = await sendChatMessage(slug, student, input("Mesaj anterior citit"), allow);
  const newerIncoming = await sendChatMessage(slug, student, input("Mesaj nou necitit"), allow);
  const newerRecord = await db.chatMessage.findUniqueOrThrow({ where: { id: newerIncoming.id } });
  const incomingBatch = newerRecord.emailBatchId!;
  await acknowledgeChatMessages(slug, patient, [olderIncoming.id]);
  await db.chatEmailBatch.update({ where: { id: incomingBatch }, data: { dueAt: new Date(0) } });
  assert.deepEqual(await getChatEmailQueueStatus(), { failedBatches: 0, overdueBatches: 1 });
  await db.chatEmailBatch.update({ where: { id: incomingBatch }, data: { leaseUntil: new Date(Date.now() + 60_000) } });
  assert.equal((await getChatEmailQueueStatus()).overdueBatches, 0, "leased work is not a stuck batch");
  await db.chatEmailBatch.update({ where: { id: incomingBatch }, data: { leaseUntil: null } });
  const beforeThreeMinutes = new Date(newerRecord.createdAt.getTime() + 180_000 - 1);
  await processChatEmails(deliver, beforeThreeMinutes);
  assert.equal(calls, 2, "an unread message younger than three minutes must not trigger an email");
  assert.equal((await db.chatEmailBatch.findUniqueOrThrow({ where: { id: incomingBatch } })).dueAt.getTime(), newerRecord.createdAt.getTime() + 180_000);
  await processChatEmails(deliver, new Date(newerRecord.createdAt.getTime() + 180_000));
  assert.equal(calls, 3, "an unread message becomes eligible at exactly three minutes");
  assert.deepEqual(await getChatEmailQueueStatus(), { failedBatches: 0, overdueBatches: 0 });
  await db.chatEmailBatch.update({ where: { id: incomingBatch }, data: { status: "FAILED", lastErrorCode: "RETRIES_EXHAUSTED" } });
  assert.deepEqual(await getChatEmailQueueStatus(), { failedBatches: 1, overdueBatches: 0 }, "exhausted batches remain visible even when no retry is due");
  await db.chatEmailBatch.update({ where: { id: incomingBatch }, data: { status: "SENT", lastErrorCode: null } });
  await db.chatMessage.deleteMany({ where: { id: { in: [olderIncoming.id, newerIncoming.id] } } });

  // A terminal transition during moderation must be rechecked before persistence.
  await assert.rejects(sendChatMessage(slug, patient, input("Mesaj întârziat"), async () => {
    await db!.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED", completedAt: new Date(), statusChangedAt: new Date(Date.now() - 8 * 86_400_000) } });
    return allow();
  }), code("CHAT_CLOSED"));
  assert.equal((await listChatConversations(patient, true)).conversations.length, 1);
  assert.equal((await getChatPage(slug, patient)).conversation.canSend, false);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).chatSlug, slug, "conversation identity remains stable after appointment state changes");
  assert.equal((await getChatPage(slug, patient)).messages.length, 3);
  await db.appointment.update({ where: { id: appointment.id }, data: { status: "CONFIRMED", completedAt: null, statusChangedAt: new Date() } });

  // Pagination and receipts remain scoped even when IDs from another conversation are supplied.
  const history = Array.from({ length: 53 }, (_, i) => ({ appointmentId: appointment.id, senderUserId: student.id, recipientUserId: patient.id, text: `Mesaj fictiv din istoric ${i + 1}`, clientId: randomUUID(), moderationVersion: "test-fixture", createdAt: new Date(Date.now() - (60 - i) * 60_000) }));
  await db.chatMessage.createMany({ data: history });
  const latest = await getChatPage(slug, patient);
  assert.equal(latest.messages.length, 50); assert.ok(latest.olderCursor);
  const older = await getChatPage(slug, patient, latest.olderCursor!);
  assert.equal(older.messages.length, 6);
  assert.equal(new Set([...latest.messages, ...older.messages].map((m) => m.id)).size, 56);
  await db.chatSendAttempt.createMany({ data: Array.from({ length: 20 }, () => ({ userId: patient.id })) });
  await assert.rejects(sendChatMessage(slug, patient, input("Prea multe încercări"), allow), code("RATE_LIMITED"));
  await db.chatSendAttempt.deleteMany();
  console.log("PASS: isolated database tests — access, moderation, idempotency, read receipts, privacy, email grouping/retries/leases/cooldown, closure and pagination.");
  if (process.env.CHAT_KEEP_TEST_DB === "1") {
    const config = Object.fromEntries(["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "CHAT_WORKER_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "OPENAI_API_KEY"].map((key) => [key, process.env[key] ?? ""]));
    config.CHAT_TEST_PASSWORD = testPassword;
    await writeFile(".env.chat-test", Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ testDatabase: databaseName, patientEmail: patient.email, studentEmail: student.email, testPassword, conversation: slug }));
    preserve = true;
  }
} finally {
  await db?.$disconnect();
  if (!preserve) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log("Temporary test database removed.");
  }
  await admin.end();
}
