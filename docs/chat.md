# Appointment chat

## Access and lifecycle

`/cont/mesaje` lists one conversation per appointment with `confirmedAt != null`. Only the appointment's authenticated, email-verified patient and student may read or send messages. Responses exclude account emails, birth dates, and profile IDs.

Conversations use `/cont/mesaje/{chatSlug}`. `Appointment.chatSlug` is a stable, database-generated 12-character lowercase hexadecimal identifier with format and uniqueness constraints. Appointment creation retries chat-slug collisions only. The appointment's `routeSlug` remains separate. Legacy chat links resolve after authorization and redirect to the canonical URL; previously frozen email retry URLs remain unchanged.

Terminal appointments move to past conversations immediately. Sending closes exactly seven elapsed days after `statusChangedAt`; new messages do not extend that deadline. History remains readable. Messages are plain text, limited to 2,000 characters.

## Client behavior

- Messages, inbox, and unread conversation counts refresh every three seconds while the page is visible, with immediate refresh on visibility, focus, and reconnect. Requests time out after ten seconds; header and account counters share the same update source.
- New messages preserve drafts and reading position. A new-message control appears when the reader is above the latest message.
- Read receipts acknowledge only visible incoming message IDs in the focused conversation. Inbox and header reads do not consume messages.
- Chat pages fill the remaining `100dvh` between the header and footer. Conversation lists and message history scroll independently; the composer stays visible. Mobile lists and conversations use separate pages. `interactiveWidget: "resizes-content"` requests keyboard-aware resizing where supported. Other pages retain normal document scrolling.

## Moderation

[`src/lib/chat/moderation.ts`](../src/lib/chat/moderation.ts) runs `omni-moderation-latest`, followed by a structured contextual verdict through the Responses API using `gpt-4.1-mini` by default. The policy permits dental descriptions and respectful complaints while blocking personal attacks, threats, harassment, discrimination, blackmail, and spam. Automated classification can make mistakes.

Only the current message text is sent to OpenAI. Responses requests use `store: false`; this does not itself disable provider abuse-monitoring logs. The application explains processing on its moderation information page.

Blocked messages are not persisted or included in emails. Timeouts, refusals, malformed responses, quota failures, and provider outages fail closed and preserve the browser draft. PostgreSQL-backed limits of 20 attempts per minute and 200 per hour per user apply before external calls. Investigate provider quota errors without bypassing moderation.

## Configuration and processes

Keep server configuration in the untracked `.env` or a secret store:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Moderation provider credential |
| `OPENAI_MODERATION_MODEL` | Contextual model; defaults to `gpt-4.1-mini` |
| `CHAT_WORKER_SECRET` | Shared random secret of at least 32 characters for app and worker |
| `CHAT_WORKER_URL` | Internal application origin reachable by the worker |
| `BETTER_AUTH_URL` | Final public origin for authentication and email links |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email provider credential and sender |

`npm run dev` starts Next.js and the email worker together; stopping it stops both. `npm run dev:web` starts only Next.js. With the application already running, `npm run chat:emails` starts the worker separately. The worker can send real emails: use an isolated test database for QA.

Production runs the separate `chat-email-worker` service from [`compose.production.yaml`](../compose.production.yaml). Its state survives restarts in PostgreSQL. Apply reviewed migrations once, before updating the application and worker, following the [deployment procedure](deployment.md#manual-migrations-failure-recovery-and-rollback). The chat migrations are `20260911100000_add_moderated_appointment_chat` and `20260912100000_add_chat_conversation_slug`; the latter backfills identifiers without changing message history.

## Email delivery and recovery

The worker polls every 15 seconds. A batch becomes eligible when its oldest still-unread message is at least three minutes old, with a 15-minute cooldown per conversation and recipient. Reading messages before dispatch suppresses their notification. If only a newer unread message remains, its own three-minute delay applies. Emails exclude message text, patient names, and clinical details.

Delivery uses persistent batches, per-recipient/conversation locks, 60-second leases with ownership tokens, and stable Resend idempotency keys. Recipient, sender, and URL are frozen on the first attempt. Retries stop after eight attempts or 23 hours, within the provider's 24-hour idempotency window. Investigate `FAILED` batches; do not retry an uncertain delivery with a new key.

Monitor queue age, failed batches, worker availability, and provider quota. Do not log message text, credentials, or raw provider responses. History has no automatic deletion; retention, export, and deletion procedures must cover it before processing real patient data.

## Worker health

`node scripts/chat-email-worker.mjs --healthcheck` reads local status without calling providers. Exit code 0 indicates healthy processing; code 1 indicates processing errors, status older than 120 seconds, permanently failed batches, or eligible batches delayed more than five minutes without an active lease. Normal shutdown records `STOPPED`.

The Linux default status file is `/tmp/universident-chat-email-worker-health.json`, configurable with `CHAT_WORKER_HEALTH_FILE`. Writes are atomic and contain no messages, recipients, or secrets. Compose checks every 30 seconds and marks the worker unhealthy after three failures. The worker continues retrying and can recover to healthy; Compose health status alone does not restart it or send alerts.

## Verification

Run `npm run check`, `npm run db:validate`, and the isolated integration suite against an intended local PostgreSQL instance:

```bash
node --conditions=react-server --import tsx scripts/test-chat-integration.ts
```

The integration script validates a local connection, creates a randomly named test database, applies migrations, and removes that database afterward. It requires database-creation privileges, leaves the configured database's data unchanged, and injects OpenAI/Resend test providers. Coverage includes authorization, privacy, slugs, moderation, idempotency, read receipts, email timing, concurrent retries, leases, closure, and pagination.

For manual QA, `CHAT_KEEP_TEST_DB=1` retains only the generated test database and writes its configuration and random fixture credentials to the Git-ignored `.env.chat-test`. After stopping the temporary app, verify the generated database name and remove only that database and file. Do not use this configuration for production.

Release validation also requires the [dependency audit](dependency-security.md) and an authorized email smoke test. Simulated providers do not verify production DNS or inbox delivery.
