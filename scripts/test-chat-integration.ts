import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { Client } from "pg";
import { hashPassword } from "better-auth/crypto";
import type { AccountPolicyConfirmation } from "../src/generated/prisma/client";
import { policyConfirmations, signUpPolicyHeader } from "../src/lib/account/policy-confirmations";

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
  const { sendChatMessage, getChatPage, listChatConversations, acknowledgeChatMessages, unreadChatCount, reportMedicalChatMessage } = await import("../src/lib/chat/service");
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

  // Exercise the application auth handlers against the migrated account schema.
  // These verified fixtures never trigger verification or password-reset emails.
  const { GET: authGet, POST: authPost } = await import("../src/app/api/auth/[...all]/route");
  const { POST: confirm } = await import("../src/app/api/confirmari-cont/route");
  const { GET: chatUnread } = await import("../src/app/api/mesaje/necitite/route");
  const authOrigin = process.env.BETTER_AUTH_URL;
  const unsignedSignup = await authPost(new Request(authOrigin + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: authOrigin, "x-universident-account-type": "student", [signUpPolicyHeader]: "old-version" },
    body: JSON.stringify({ name: "Student fără declarație", email: "unsigned@example.invalid", password: testPassword }),
  }));
  assert.equal(unsignedSignup.status, 400);
  assert.equal(await db.user.count({ where: { email: "unsigned@example.invalid" } }), 0);
  const signIn = (email: string, password: string) => authPost(new Request(`${authOrigin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: authOrigin,
      "x-forwarded-for": email === patient.email ? "192.0.2.1" : "192.0.2.2",
    },
    body: JSON.stringify({ email, password }),
  }));
  assert.equal((await signIn(patient.email, `${testPassword}-incorrect`)).status, 401);
  let patientCookie: string | undefined;
  for (const user of [patient, student]) {
    const login = await signIn(user.email, testPassword);
    assert.equal(login.status, 200, "existing credential accounts must still sign in");
    const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.ok(cookie, "sign-in must issue a session cookie");
    const sessionResponse = await authGet(new Request(`${authOrigin}/api/auth/get-session`, { headers: { cookie } }));
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.equal(session.user.id, user.id);
    assert.equal(session.user.role, user.role);
    assert.equal(session.user.emailVerified, true);

    const chatRequest = () => new Request(authOrigin + "/api/mesaje/necitite", { headers: { cookie } });
    const confirmationRequest = (version: string, confirmed = true, origin = authOrigin) => new Request(authOrigin + "/api/confirmari-cont", {
      method: "POST", headers: { "content-type": "application/json", cookie, origin },
      body: JSON.stringify({ confirmed, version }),
    });
    const confirmationForm = (fields: Record<string, string>) => new Request(authOrigin + "/api/confirmari-cont", {
      method: "POST", headers: { cookie, origin: authOrigin },
      body: new URLSearchParams(fields),
    });
    const accountPolicy = user.role === "PATIENT" ? policyConfirmations.patientPrivacy : policyConfirmations.studentDeclaration;
    const chatPolicy = user.role === "PATIENT" ? policyConfirmations.patientChat : policyConfirmations.studentChat;
    const wrongChatPolicy = user.role === "PATIENT" ? policyConfirmations.studentChat : policyConfirmations.patientChat;
    assert.equal((await chatUnread(chatRequest())).status, 403);
    assert.equal((await confirm(confirmationRequest(wrongChatPolicy.version))).status, 400);
    assert.equal((await confirm(confirmationRequest(accountPolicy.version, false))).status, 400);
    assert.equal((await confirm(confirmationRequest(accountPolicy.version, true, "https://example.invalid"))).status, 403);
    const next = "/cont/mesaje/0123456789ab";
    const confirmationLocation = "/confirma-reguli?" + new URLSearchParams({ next });
    assert.equal((await confirm(confirmationForm({ next }))).status, 400);
    const accountFormResponse = await confirm(confirmationForm({ confirmedPolicy: accountPolicy.version, next }));
    assert.equal(accountFormResponse.status, 303);
    assert.equal(accountFormResponse.headers.get("location"), confirmationLocation);
    assert.equal((await chatUnread(chatRequest())).status, 403);
    const chatFormResponse = await confirm(confirmationForm({ confirmedPolicy: chatPolicy.version, next }));
    assert.equal(chatFormResponse.status, 303);
    assert.equal(chatFormResponse.headers.get("location"), confirmationLocation);
    const savedConfirmations: AccountPolicyConfirmation[] = await db.accountPolicyConfirmation.findMany({
      where: { userId: user.id },
      orderBy: { policy: "asc" },
    });
    assert.deepEqual(savedConfirmations.map(({ version }) => version).sort(), [accountPolicy.version, chatPolicy.version].sort());
    assert.equal((await confirm(confirmationRequest(chatPolicy.version))).status, 204);
    const retriedFormResponse = await confirm(confirmationForm({
      confirmedPolicy: chatPolicy.version,
      next: "//example.invalid",
    }));
    assert.equal(retriedFormResponse.status, 303);
    assert.equal(retriedFormResponse.headers.get("location"), "/confirma-reguli");
    assert.deepEqual(await db.accountPolicyConfirmation.findMany({
      where: { userId: user.id },
      orderBy: { policy: "asc" },
    }), savedConfirmations);
    assert.equal((await chatUnread(chatRequest())).status, 200);
    const foreignOrigin = await authPost(new Request(`${authOrigin}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, origin: "https://untrusted.example.invalid" },
    }));
    assert.equal(foreignOrigin.status, 403, "cross-origin account mutations must remain blocked");
    const logout = await authPost(new Request(`${authOrigin}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, origin: authOrigin },
    }));
    assert.equal(logout.status, 200);
    const loggedOut = await authGet(new Request(`${authOrigin}/api/auth/get-session`, { headers: { cookie } }));
    assert.equal(await loggedOut.json(), null, "sign-out must invalidate the stored session");
    const laterLogin = await signIn(user.email, testPassword);
    assert.equal(laterLogin.status, 200);
    const freshCookie = laterLogin.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.equal((await chatUnread(new Request(chatRequest(), { headers: { cookie: freshCookie } }))).status, 200);
    if (user.id === patient.id) patientCookie = freshCookie;
  }
  assert.ok(patientCookie);
  console.log("PASS: credential sign-in, participant roles, origin checks and session invalidation.");

  const pp = await db.patientProfile.create({ data: { userId: patient.id, profileSlug: "pacient-chat-test", dateOfBirth: new Date("1990-01-01") } });
  const studentSlug = "student-chat-test";
  const sp = await db.studentProfile.create({ data: { userId: student.id, publicSlug: studentSlug, university: "UMFCD", studyYear: 4, isPublished: true, publishedAt: new Date() } });
  const city = await db.city.create({ data: { name: "Oraș test", slug: "oras-test" } });
  const treatment = await db.treatment.create({ data: { name: "Consultație de test", slug: "consultatie-test", description: "Test local" } });
  const location = await db.studentLocation.create({ data: { studentProfileId: sp.id, cityId: city.id, routeKey: "abc123", name: "Cabinet Test", address: "Adresă fictivă" } });
  const st = await db.studentTreatment.create({ data: { studentProfileId: sp.id, treatmentId: treatment.id, durationMinutes: 30 } });
  const start = new Date(Date.now() + 2 * 86_400_000); start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 4 * 3_600_000);
  const slot = await db.studentAvailabilitySlot.create({ data: { studentProfileId: sp.id, studentLocationId: location.id, originalStartsAt: start, startsAt: start, endsAt: end } });
  const offering = await db.studentAvailabilitySlotOffering.create({ data: { slotId: slot.id, studentProfileId: sp.id, studentTreatmentId: st.id } });
  const appointmentData = {
    patientProfileId: pp.id, studentProfileId: sp.id, studentAvailabilitySlotId: slot.id, studentAvailabilitySlotOfferingId: offering.id,
    patientAgeAtAppointment: 36, patientNameSnapshot: patient.name, studentNameSnapshot: student.name,
    treatmentNameSnapshot: treatment.name, locationNameSnapshot: location.name, locationAddressSnapshot: location.address, studentUniversitySnapshot: sp.university,
  };
  const appointment = await db.appointment.create({ data: { ...appointmentData, routeSlug: "consultatie-chat-test", scheduledStartsAt: start, scheduledEndsAt: new Date(start.getTime() + 1_800_000), status: "CONFIRMED", confirmedAt: new Date() } });
  const { POST: bookAppointment } = await import("../src/app/api/studenti/[studentSlug]/programari/route");
  const privateNote = "Notă privată pentru programarea de test.";
  const bookingBody = JSON.stringify({
    slotId: slot.id,
    offeringId: offering.id,
    startsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    idempotencyKey: randomUUID(),
    patientNote: privateNote,
  });
  const book = () => bookAppointment(new Request(`${authOrigin}/api/studenti/${studentSlug}/programari`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: authOrigin, cookie: patientCookie },
    body: bookingBody,
  }), { params: Promise.resolve({ studentSlug }) });
  const booking = await book();
  assert.equal(booking.status, 201);
  const { appointment: { routeSlug } } = await booking.json();
  const retriedBooking = await book();
  assert.equal(retriedBooking.status, 201);
  assert.deepEqual(await retriedBooking.json(), { appointment: { routeSlug } });
  const pending = await db.appointment.findUniqueOrThrow({ where: { routeSlug } });
  assert.equal(pending.status, "PENDING");
  const requestJobs = await db.appointmentEmail.findMany({ where: { appointmentId: pending.id, kind: "REQUEST_CREATED" } });
  assert.equal(requestJobs.length, 1, "repeating the booking request must queue exactly one email");
  assert.equal(requestJobs[0].status, "PENDING");
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
  const secondRecord = await db.chatMessage.findUniqueOrThrow({ where: { id: second.id } });
  const secondBatch = secondRecord.emailBatchId!;
  const studentEligibleAt = secondRecord.createdAt.getTime() + 180_000;
  await processChatEmails(deliver, new Date(studentEligibleAt - 1));
  assert.equal(calls, 0, "the student must not be emailed before three minutes");
  await processChatEmails(async (payload) => { received.push(payload); throw new Error("simulated network failure"); }, new Date(studentEligibleAt));
  assert.equal(received[0]?.to, student.email, "the student becomes eligible at three minutes");
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
  assert.equal(received.at(-1)?.to, patient.email, "the patient receives the same unread email");
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
  const reportMessage = latest.messages[0];
  await assert.rejects(reportMedicalChatMessage(slug, outsider, reportMessage.id), code("NOT_FOUND"));
  await assert.rejects(reportMedicalChatMessage(slug, patient, randomUUID()), code("NOT_FOUND"));
  await reportMedicalChatMessage(slug, patient, reportMessage.id);
  await reportMedicalChatMessage(slug, patient, reportMessage.id);
  assert.equal(await db.chatMedicalDataReport.count({ where: { messageId: reportMessage.id, reporterUserId: patient.id } }), 1);
  assert.equal(latest.messages.length, 50); assert.ok(latest.olderCursor);
  const older = await getChatPage(slug, patient, latest.olderCursor!);
  assert.equal(older.messages.length, 6);
  assert.equal(new Set([...latest.messages, ...older.messages].map((m) => m.id)).size, 56);
  await db.chatSendAttempt.createMany({ data: Array.from({ length: 20 }, () => ({ userId: patient.id })) });
  await assert.rejects(sendChatMessage(slug, patient, input("Prea multe încercări"), allow), code("RATE_LIMITED"));
  await db.chatSendAttempt.deleteMany();
  const { actOnAppointment } = await import("../src/lib/appointments/appointment-service");
  const { processAppointmentEmails } = await import("../src/lib/appointments/appointment-email-worker");
  const { POST: runEmailWorker } = await import("../src/app/api/internal/chat-emails/route");
  const staleJob = await db.appointmentEmail.create({ data: {
    appointmentId: appointment.id, kind: "REQUEST_CREATED", dueAt: new Date(),
  } });
  const requestEmails: Array<{ idempotencyKey: string | null; body: string }> = [];
  const originalFetch = globalThis.fetch;
  const jobId = requestJobs[0].id;
  try {
    globalThis.fetch = async (resource, options) => {
      assert.equal(String(resource), "https://api.resend.com/emails");
      assert.equal(options?.method, "POST");
      requestEmails.push({
        idempotencyKey: new Headers(options?.headers).get("Idempotency-Key"),
        body: String(options?.body),
      });
      if (requestEmails.length === 1) return new Response(null, { status: 503 });
      return Response.json({ id: "fake-resend-request-email" });
    };
    const workerResponse = await runEmailWorker(new Request(`${authOrigin}/api/internal/chat-emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CHAT_WORKER_SECRET}` },
    }));
    assert.equal(workerResponse.status, 200);
    assert.equal((await workerResponse.json()).failed, 1);
    assert.equal(requestEmails.length, 1, "only the pending request should reach Resend");
    assert.equal((await db.appointmentEmail.findUniqueOrThrow({ where: { id: staleJob.id } })).status, "SKIPPED");

    const retry = await db.appointmentEmail.findUniqueOrThrow({ where: { id: jobId } });
    assert.equal(retry.attempts, 1);
    assert.equal((await processAppointmentEmails(undefined, new Date(retry.dueAt.getTime() - 1))).sent, 0);
    assert.equal((await processAppointmentEmails(undefined, retry.dueAt)).sent, 1);
    assert.equal((await processAppointmentEmails(undefined, retry.dueAt)).sent, 0);
    assert.equal(requestEmails.length, 2, "the successful retry must not be sent again");
    assert.deepEqual(requestEmails[1], requestEmails[0], "Resend retries must reuse the payload and idempotency key");
    assert.equal(requestEmails[0].idempotencyKey, `universident-appointment/${jobId}`);
    const email = JSON.parse(requestEmails[0].body);
    assert.equal(email.to, student.email);
    assert.equal(email.from, process.env.EMAIL_FROM);
    assert.match(email.subject, /cerere de programare/);
    assert.ok(email.text.includes(`${authOrigin}/cont/programari`));
    assert.ok(email.html.includes(`href="${authOrigin}/cont/programari"`));
    for (const value of [patient.name, patient.email, privateNote, treatment.name]) {
      assert.equal(requestEmails[0].body.includes(value), false, "the email must omit private appointment details");
    }
    const sent = await db.appointmentEmail.findUniqueOrThrow({ where: { id: jobId } });
    assert.equal(sent.status, "SENT");
    assert.equal(sent.resendEmailId, "fake-resend-request-email");
  } finally {
    globalThis.fetch = originalFetch;
  }
  for (const target of [appointment, pending]) {
    await actOnAppointment(target.routeSlug, patient, {
      action: "CANCEL",
      expectedVersion: target.version,
      reason: "Nu mai sunt disponibil la ora programată.",
      rating: null,
      comment: null,
    });
  }
  const cancellationEmails: Array<{ to: string; kind: string; url: string }> = [];
  const deliverCancellation = async ({ to, kind, url }: (typeof cancellationEmails)[number]) => {
    cancellationEmails.push({ to, kind, url });
    return "fake-resend-cancellation-email";
  };
  assert.equal((await processAppointmentEmails(deliverCancellation)).sent, 2);
  assert.equal((await processAppointmentEmails(deliverCancellation)).sent, 0, "cancellation emails are sent once");
  for (const email of cancellationEmails) {
    assert.deepEqual(email, {
      to: student.email,
      kind: "CANCELLED_BY_PATIENT",
      url: authOrigin + "/cont/programari",
    });
  }
  console.log("PASS: isolated database tests — access, moderation, idempotency, read receipts, privacy, chat email delivery, appointment request and cancellation emails, closure and pagination.");
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
