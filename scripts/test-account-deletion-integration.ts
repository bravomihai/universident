import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";

// Fixtures run only in a fresh database on a local PostgreSQL server.
const source = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) {
  throw new Error("LOCAL_DATABASE_REQUIRED");
}
const databaseName = `universident_deletion_test_${randomBytes(6).toString("hex")}`;
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${databaseName}"`);
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = testUrl.toString();
process.env.BETTER_AUTH_URL = "http://localhost:3100";
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
process.env.RESEND_API_KEY = "test-only-no-external-email";
process.env.EMAIL_FROM = "Universident <no-reply@example.invalid>";

let db: PrismaClient | undefined;
const originalFetch = globalThis.fetch;
try {
  const migrate = spawnSync("npx", ["--no-install", "prisma", "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  if (migrate.status !== 0) throw new Error(`TEST_MIGRATIONS_FAILED: ${migrate.stderr}`);
  const database: PrismaClient = (await import("../src/lib/prisma")).prisma;
  db = database;
  const { POST, DELETE } = await import("../src/app/api/account/stergere/route");
  const { POST: authPost, GET: authGet } = await import("../src/app/api/auth/[...all]/route");
  const { accountDeletionIdentity, requestAccountDeletion, confirmAccountDeletion } = await import("../src/lib/account/account-deletion-service");
  const { accountDeletionDigest } = await import("../src/lib/account/account-deletion-policy");
  const { sendChatMessage, listChatConversations } = await import("../src/lib/chat/service");
  const { actOnAppointment, reviewAppointment } = await import("../src/lib/appointments/appointment-service");
  const password = randomBytes(20).toString("hex");
  const passwordHash = await hashPassword(password);
  const origin = process.env.BETTER_AUTH_URL;
  const sent: Array<{ to: string; text: string }> = [];
  let deliveryFails = false;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.resend.com/emails", "tests must never contact an external service");
    if (deliveryFails) return Response.json({}, { status: 503 });
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "fake-deletion-email" });
  };
  const tokenFromEmail = () => {
    const token = sent.at(-1)?.text.match(/confirma-stergerea-contului#([a-zA-Z0-9_-]{43})/)?.[1];
    assert.ok(token);
    return token;
  };
  const city = await database.city.create({ data: { name: "Test deletion", slug: "test-deletion" } });
  const treatment = await database.treatment.create({ data: { name: "Test deletion", slug: "test-deletion", description: "Test" } });

  for (const role of ["PATIENT", "STUDENT"] as const) {
    const sentBefore = sent.length;
    const patient = await database.user.create({ data: {
      id: randomUUID(), email: `${randomUUID()}@example.invalid`, name: "Pacient Test", role: "PATIENT", emailVerified: true,
    } });
    const student = await database.user.create({ data: {
      id: randomUUID(), email: `${randomUUID()}@example.invalid`, name: "Student Test", role: "STUDENT", emailVerified: true,
    } });
    const actor = role === "PATIENT" ? patient : student;
    const other = role === "PATIENT" ? student : patient;
    await database.account.create({ data: { id: randomUUID(), accountId: actor.id, userId: actor.id, providerId: "credential", password: passwordHash } });
    const pp = await database.patientProfile.create({ data: { userId: patient.id, profileSlug: randomUUID(), dateOfBirth: new Date("1990-01-01"), bio: "Private bio" } });
    const sp = await database.studentProfile.create({ data: { userId: student.id, publicSlug: randomUUID(), university: "UMFCD", studyYear: 4, bio: "Student bio" } });
    await database.patientProfileImage.create({ data: { patientProfileId: pp.id, data: Buffer.from("test"), byteSize: 4, contentType: "image/png" } });
    await database.studentProfileImage.create({ data: { studentProfileId: sp.id, data: Buffer.from("test"), byteSize: 4, contentType: "image/png" } });
    const location = await database.studentLocation.create({ data: { studentProfileId: sp.id, cityId: city.id, routeKey: "abc123", name: "Private location", address: "Private address" } });
    const st = await database.studentTreatment.create({ data: { studentProfileId: sp.id, treatmentId: treatment.id, durationMinutes: 30 } });
    const start = new Date(Date.now() + 2 * 86_400_000);
    start.setUTCHours(9, 0, 0, 0);
    const slot = await database.studentAvailabilitySlot.create({ data: { studentProfileId: sp.id, studentLocationId: location.id, originalStartsAt: start, startsAt: start, endsAt: new Date(start.getTime() + 4 * 3_600_000) } });
    const offering = await database.studentAvailabilitySlotOffering.create({ data: { slotId: slot.id, studentProfileId: sp.id, studentTreatmentId: st.id } });
    const base = {
      patientProfileId: pp.id, studentProfileId: sp.id, studentAvailabilitySlotId: slot.id, studentAvailabilitySlotOfferingId: offering.id,
      patientAgeAtAppointment: 36, patientNameSnapshot: patient.name, studentNameSnapshot: student.name,
      treatmentNameSnapshot: treatment.name, locationNameSnapshot: location.name, locationAddressSnapshot: location.address,
      studentUniversitySnapshot: sp.university, patientNote: "Private note",
    };
    const appointment = await database.appointment.create({ data: { ...base, routeSlug: randomUUID(), scheduledStartsAt: start, scheduledEndsAt: new Date(start.getTime() + 1_800_000), status: "CONFIRMED", confirmedAt: new Date() } });
    const pending = await database.appointment.create({ data: { ...base, routeSlug: randomUUID(), scheduledStartsAt: new Date(start.getTime() + 3_600_000), scheduledEndsAt: new Date(start.getTime() + 5_400_000), status: "PENDING", pendingExpiresAt: new Date(Date.now() + 3_600_000) } });
    await database.appointmentReview.create({ data: { appointmentId: appointment.id, authorUserId: student.id, targetUserId: patient.id, authorRole: "STUDENT", rating: 5, comment: "Private review", publishedAt: new Date() } });
    await database.chatMessage.create({ data: { appointmentId: appointment.id, senderUserId: actor.id, recipientUserId: other.id, clientId: randomUUID(), text: "Private message", moderationVersion: "test" } });
    await database.appointmentEmail.create({ data: { appointmentId: appointment.id, kind: "CONFIRMED", dueAt: new Date(), recipientEmail: actor.email } });
    await database.appointmentNotification.create({ data: { appointmentId: appointment.id, recipientUserId: actor.id, eventType: "CONFIRMED" } });

    const login = await authPost(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ email: actor.email, password }),
    }));
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const request = (currentPassword = password, requestOrigin = origin, requestCookie = cookie) => new Request(`${origin}/api/account/stergere`, {
      method: "POST", headers: { "content-type": "application/json", origin: requestOrigin, cookie: requestCookie }, body: JSON.stringify({ currentPassword }),
    });
    const confirmation = (token: string, requestOrigin = origin) => new Request(`${origin}/api/account/stergere`, {
      method: "DELETE", headers: { "content-type": "application/json", origin: requestOrigin }, body: JSON.stringify({ token }),
    });
    assert.equal((await POST(request(password, "https://untrusted.example.invalid"))).status, 403);
    assert.equal((await POST(request(password, origin, ""))).status, 401);
    assert.equal((await POST(request("incorrect-password"))).status, 400);
    assert.equal(sent.length, sentBefore);
    assert.equal((await POST(request())).status, 202);
    const token = tokenFromEmail();
    const identity = await accountDeletionIdentity(actor.id);
    assert.ok(identity);
    const verificationId = `universident:account-deletion:${actor.id}`;
    const saved = await database.verification.findUniqueOrThrow({ where: { id: verificationId } });
    assert.equal(saved.identifier, `universident:account-deletion:${accountDeletionDigest(token)}`);
    assert.equal(saved.value.includes(token), false);
    assert.equal(await database.user.count({ where: { id: actor.id } }), 1, "requesting a link does not delete the account");
    assert.equal((await POST(request())).status, 429);
    assert.equal((await DELETE(confirmation(token, "https://untrusted.example.invalid"))).status, 403);
    assert.equal((await DELETE(confirmation("invalid"))).status, 400);
    await database.verification.update({ where: { id: verificationId }, data: { expiresAt: new Date(0) } });
    assert.equal((await DELETE(confirmation(token))).status, 400, "expired links cannot delete an account");
    await database.verification.update({ where: { id: verificationId }, data: { updatedAt: new Date(0) } });
    await requestAccountDeletion(identity);
    const replacementToken = tokenFromEmail();
    assert.equal((await DELETE(confirmation(token))).status, 400, "reissuing a link invalidates the old link");
    await database.account.updateMany({ where: { userId: actor.id }, data: { password: "changed-password-hash" } });
    assert.equal((await DELETE(confirmation(replacementToken))).status, 400, "a password change invalidates existing links");
    await database.account.updateMany({ where: { userId: actor.id }, data: { password: passwordHash } });
    await database.verification.update({ where: { id: verificationId }, data: { updatedAt: new Date(0) } });
    deliveryFails = true;
    await assert.rejects(requestAccountDeletion(identity));
    deliveryFails = false;
    assert.equal(await database.verification.count({ where: { id: verificationId } }), 0, "failed delivery does not leave a usable link");
    await requestAccountDeletion(identity);
    const finalToken = tokenFromEmail();
    const results = await Promise.all([DELETE(confirmation(finalToken)), DELETE(confirmation(finalToken))]);
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 400], "confirmation is single-use even when concurrent");
    assert.equal(await database.user.count({ where: { id: actor.id } }), 0);
    assert.equal(await database.account.count({ where: { userId: actor.id } }), 0);
    assert.equal(await database.session.count({ where: { userId: actor.id } }), 0);
    const session = await authGet(new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }));
    assert.equal(await session.json(), null);
    assert.equal(await database.user.count({ where: { id: other.id } }), 1);
    for (const target of [appointment, pending]) {
      const retained = await database.appointment.findUniqueOrThrow({ where: { id: target.id } });
      assert.equal(retained.participantDeleted, true);
      assert.equal(retained.patientNote, null);
      assert.equal(retained.scheduledStartsAt.getTime(), target.scheduledStartsAt.getTime());
      assert.equal(retained[role === "PATIENT" ? "patientNameSnapshot" : "studentNameSnapshot"], "Cont șters");
      if (role === "PATIENT") assert.equal(retained.patientAgeAtAppointment, null);
      assert.equal(retained.status, role === "PATIENT" ? "CANCELLED_BY_PATIENT" : target.id === pending.id ? "REJECTED" : "CANCELLED_BY_STUDENT");
    }
    assert.equal(await database.appointmentReview.count({ where: { appointmentId: appointment.id } }), 0);
    assert.equal(await database.chatMessage.count({ where: { appointmentId: appointment.id } }), 0);
    assert.equal(await database.appointmentEmail.count({ where: { appointmentId: appointment.id } }), 0);
    assert.equal(await database.appointmentNotification.count({ where: { recipientUserId: actor.id } }), 0);
    assert.equal(await database.appointmentNotification.count({ where: { recipientUserId: other.id } }), 2);
    assert.equal((await listChatConversations(other)).conversations.length, 0);
    assert.equal((await listChatConversations(other, true)).conversations.length, 1);
    await assert.rejects(sendChatMessage(appointment.chatSlug, other, { text: "Message after deletion", clientId: randomUUID() }), { code: "CHAT_CLOSED" });
    await assert.rejects(actOnAppointment(appointment.routeSlug, other, { action: "CANCEL", expectedVersion: appointment.version + 1, reason: "This appointment cannot change anymore.", rating: null, comment: null }), { code: "ACTION_NOT_ALLOWED" });
    await assert.rejects(reviewAppointment(appointment.routeSlug, other, { rating: 5, comment: null }), { code: "REVIEW_NOT_AVAILABLE" });
    if (role === "PATIENT") {
      const retained = await database.patientProfile.findUniqueOrThrow({ where: { id: pp.id } });
      assert.equal(retained.dateOfBirth, null);
      assert.equal(retained.bio, null);
      assert.notEqual(retained.profileSlug, pp.profileSlug);
      assert.equal(await database.patientProfileImage.count({ where: { patientProfileId: pp.id } }), 0);
    } else {
      const retained = await database.studentProfile.findUniqueOrThrow({ where: { id: sp.id } });
      assert.equal(retained.publicSlug, null);
      assert.equal(retained.isPublished, false);
      assert.equal(retained.bio, null);
      assert.equal(await database.studentProfileImage.count({ where: { studentProfileId: sp.id } }), 0);
      assert.equal((await database.studentLocation.findUniqueOrThrow({ where: { id: location.id } })).address, "Adresă retrasă");
      assert.equal((await database.studentAvailabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).status, "CANCELLED");
    }
    await assert.rejects(confirmAccountDeletion(finalToken), { code: "INVALID_LINK" });
    console.log(`PASS: ${role} deletion, password and origin checks, token expiry/replacement, delivery failure, concurrent confirmation, session invalidation and shared-history privacy.`);
  }
} finally {
  globalThis.fetch = originalFetch;
  await db?.$disconnect();
  await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
  console.log("Temporary account-deletion test database removed.");
}
