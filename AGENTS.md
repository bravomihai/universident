# Universident agent guide

## Project and product

- Universident is a Romanian-language marketplace that connects adult patients with dentistry students working under a supervisor.
- Preserve the existing Next.js App Router, React, TypeScript, Prisma/PostgreSQL, Better Auth, shadcn/Radix, Tailwind, and FullCalendar architecture.
- Keep user-facing copy in Romanian and keep the existing visual language unless the user explicitly requests a redesign.
- Prefer readable Romanian routes and dynamic slugs. Follow the API shapes and naming conventions already present in `src/app/api`.

## Commands

Run commands from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
npm run db:validate
npx prisma generate
npx prisma migrate status
npm run db:deploy
npm run db:seed
```

- The seed upserts the shared treatment, city, and Romanian dental-university catalogs. It must not create demo users or appointments.
- `npm run demo:seed` is the separate local-only UI fixture. It requires exactly one existing patient and one existing student, replaces that student's active dummy calendar, and must keep refusing non-local or production databases.
- Never reset or migrate a database before verifying that `DATABASE_URL` points to the intended local/non-production instance.
- Every Prisma schema change requires a checked-in migration. Do not use `db push` as a substitute for migrations.

## Repository map

- `src/app` contains App Router pages and HTTP route handlers.
- `src/components` contains shared UI and client-side workflows.
- `src/lib/appointments` owns appointment state transitions, notifications, reputation, and review rules.
- `src/lib/availability` owns Bucharest wall-clock conversion, recurrence materialization, calendar writes, and patient booking-window generation.
- `src/lib/public-students` owns public search ranking and public profile DTOs.
- `prisma/schema.prisma` and `prisma/migrations` are the database source of truth. `prisma/seed.ts` contains only idempotent shared catalogs.
- `scripts/seed-local-demo.ts` is a destructive local fixture and is never part of production setup.

## Deployment and operations

- Supported production runtime is Node.js 20.9 or newer; use Node 24 when possible.
- Production requires `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM`. `BETTER_AUTH_URL` must be the exact final HTTPS origin used by browsers.
- Apply migrations with `npm run db:deploy` in one serialized release step before routing traffic to the new build. Never run concurrent migration jobs from multiple application instances.
- Use pooled TLS PostgreSQL connections for serverless hosting, automated backups, and a tested restore procedure.
- `GET /api/health` is the liveness/readiness endpoint. It must stay unauthenticated, return no internal error details, and disable caching.
- Preserve the global security headers configured in `next.config.ts`; review them deliberately before adding browser capabilities or third-party embeds.
- Never commit `.env`, production dumps, API keys, auth secrets, or patient data. Keep `.env.example` placeholder-only.
- `npm audit --omit=dev`, schema validation, migration status, `npm run check`, and a smoke test of email delivery are release gates.
- Publishing code is not authorization to process real patient data. Privacy notices, retention/export/deletion procedures, vendor agreements, monitoring, incident response, and legal/security review remain operational release requirements.

## Authentication and authorization

- Better Auth is authoritative for sessions. Enforce role and ownership checks on the server for every private read and write.
- Mutating account APIs must verify the request origin and require a verified email.
- Roles are `PATIENT`, `STUDENT`, and `ADMIN`. Do not trust a role, user ID, profile ID, or ownership field supplied by the client.
- A signed-in student must not see their own listing among `/studenti` search results, although their direct public profile remains accessible.
- A student profile university must use the `shortName` of an active entry from the seeded university catalog; never accept free-form university names from the profile API.

## Scheduling invariants

- All recurring availability is defined in the `Europe/Bucharest` wall-clock timezone and materialized as UTC instants. Preserve local time across DST transitions and reject nonexistent local times.
- Materialization may run from concurrent authenticated and public reads. Keep it transactionally serialized per series, materialize active series through the public booking window before search, and never rely on a long-running application process or cron job for correctness.
- Patients can submit overlapping `PENDING` requests for different slots, but cannot have overlapping `CONFIRMED` appointments.
- A patient can request a slot until its start time. At the start time an unconfirmed request becomes `EXPIRED`.
- Confirming one request atomically marks the patient's other overlapping pending requests as `SUPERSEDED`.
- A student availability occurrence is a multi-hour block at exactly one location. It exposes one or more offerings, each pairing one student treatment with one supervisor.
- A treatment can be attached to an occurrence only when its configured duration fits completely inside the occurrence. Disable and explain treatments that are too long in the editor, and enforce the same rule server-side.
- `PENDING` and `CONFIRMED` appointments consume only their selected subinterval inside the block. Active appointment subintervals for the same student must never overlap.
- The selected subinterval length comes from `StudentTreatment.durationMinutes`; the client never supplies a duration or end time.
- Public search eligibility is based on real future calendar capacity for the exact treatment/city combination after active appointments are subtracted. Each student appears only once, is ranked by their earliest valid start across matching locations, and does not appear when no contiguous interval is long enough for the treatment.
- Prefer optimized, non-overlapping treatment windows that leave every remainder reusable by another offered treatment duration. When no exact partition exists but at least two appointments of the searched treatment fit, expose the maximum number consecutively from the start and leave the remainder unconsumed. Use all valid starts on the 15-minute grid as a fallback only when a single appointment fits; fallback never invents availability.
- Patients can cancel only before the start time. Students use `COMPLETED` or `NO_SHOW` after the scheduled end time.
- Patient cancellation, student rejection, student cancellation, and pending withdrawal require a trimmed reason of 20–500 characters.
- A patient cancellation is late only when the appointment was confirmed and is cancelled less than two hours before its start. The application-wide reputation benchmark is the number of late cancellations among the patient's 10 most recent confirmed appointments; do not expose rolling-period or lifetime counters and do not apply an automatic penalty yet.
- A student's scheduling reputation is the number of appointments cancelled by the student among their 10 most recent confirmed appointments. Derive both role-specific reputation counters from appointments instead of storing duplicate counters on profile records.
- Appointment notifications are participant-specific unread event records. A new request notifies the student; later status changes notify the other participant, and system-driven expiry or superseding notifies affected participants. Existing appointments are considered seen unless a notification record exists. Opening `/cont/programari` captures and deletes only the loaded notifications, while still highlighting their appointment cards during that first view; a consumed notification must not remain in the database.
- Moving or cancelling an occupied availability occurrence must atomically reject its pending request or cancel its confirmed appointment with a required reason. Never move the patient's appointment to the new time.
- Recurring availability created from the calendar must have an explicit end: either a finite occurrence count or an inclusive end date. The UI must not create never-ending series.
- A recurring occurrence can be edited by itself or together with the series from that occurrence onward. A single-occurrence edit becomes an exception; a series edit replaces the selected and following occurrences while preserving past appointment history. Cancelling a series removes all of its future occurrences.
- Appointments retain their scheduled time, names, treatment, location, address, supervisor, age, and note snapshots even when the underlying availability or professional resources later change.
- Treatments, locations, and supervisors owned by a student have only archived/unarchived lifecycle state. Their associations are defined exclusively on calendar occurrences; do not recreate active flags or treatment-location join records.
- Use serializable transactions and optimistic `version`/`revision` checks for scheduling writes. Database constraints are the final defense against slot and time overlaps.
- After the scheduled end, a confirmed appointment remains active and highlighted until the student records `COMPLETED` or `NO_SHOW` together with a required 1–5 rating; the review comment is optional, but must contain 10–1,000 trimmed characters when present.
- A completed appointment remains active and highlighted separately for each participant until that participant submits a 1–5 rating. A no-show is archived immediately for the patient, who cannot review it and receives no no-show notification; the student's required review is created atomically when the student records the no-show.
- A patient with an outstanding review cannot create a new appointment request. A student with an overdue confirmed appointment or missing review cannot confirm a new request. Never block one participant on the other participant's unfinished review.
- Reviews for completed appointments are blind: keep both unpublished until patient and student have submitted, then publish both atomically. For a no-show, publish the student's review of the patient immediately because no patient review is allowed.
- Published patient-to-student reviews appear on the student's public professional profile. Published student-to-patient reviews appear on the protected patient profile; public student reviews must anonymize the patient author.
- Keep Romanian count labels grammatically correct, including singular forms such as `o anulare târzie` and `o recenzie`.

## Patient data and privacy

- Patient accounts may be created without a date of birth.
- Before the first booking, require and store the date of birth once. Patients must be at least 18 and can correct the date later from their private profile.
- Calculate `patientAgeAtAppointment` from the date of birth stored on `PatientProfile` and the selected slot date, then retain it as an appointment snapshot. Never trust a client-supplied age.
- Patient and student bios are optional. Normalize blank bios to `null` and omit the entire bio section when no text exists; never render a placeholder such as "no bio" on profile or review cards.
- Patient and student names are edited from their respective profile pages. Keep account email and role read-only in the account dashboard, and never regenerate an existing public or private profile slug after a name change.
- Students receive only the patient's name, calculated age, optional bio, current note, published aggregate rating/reviews, aggregate late-cancellation reputation, and appointment history shared with that student.
- A patient review profile is private. Expose its slug and contents only to the owning patient or to a signed-in student who has at least one appointment/request with that patient.
- Never expose the patient's email, exact date of birth, other providers' appointment details, or unrelated account data to a student.
- Keep public, patient-private, and student-private response DTOs intentionally separate; do not return broad Prisma `include` graphs from APIs.

## Calendar and appointment UX

- FullCalendar is the primary scheduling surface: `timeGridWeek` on larger screens and `timeGridDay` on phones.
- Student events use consistent states: available (green), pending (amber), confirmed (blue), moved exception (violet), and selected (primary highlight). Cancelled occurrences are never rendered. Use a repeat icon for ordinary recurring occurrences and a pencil for an occurrence edited separately; do not use an undo-style arrow for either state.
- Students create and edit availability in a modal dialog opened from a calendar selection or event click. The dialog configures location, treatment offerings, and a supervisor per treatment. Outside click and the explicit cancel action close without saving.
- Patients enter booking through `/studenti/[studentSlug]/programare/[treatmentSlug]/[citySlug]`. The page combines that treatment's availability across the student's matching locations in the searched city, opens at the earliest valid occurrence, and links the aggregate rating to the professional profile; review cards remain on the profile, not on the booking page.
- The patient calendar renders availability windows, not a stack of overlapping events for every possible start. Optimized windows normally expose one start; a grouped fallback window opens a dialog where the patient selects one of its valid starts and may add an optional note.
- Calendar navigation uses `Azi`, `Mâine`, `Poimâine`, or a localized date/range between the arrows, never permits past navigation, and keeps the day/week selector on the right on phones.
- If the patient's birth date is missing, complete that profile step before enabling a booking request.
- Keep accessible labels, keyboard-focus styles, and a non-color status label wherever status is communicated by color.
- Textual navigation uses plain direction indicators consistently: clickable cards and forward actions end in `>`, while back actions begin with `<`. Reserve chevron icons for icon-only controls such as calendar navigation and disclosure menus.
- Interactive card hover states must remain clearly visible in both light and dark themes. Header controls share one height and corner radius so their hover surfaces align vertically, regardless of whether the control contains text, account details, or only an icon.

## Future features

- Review moderation is not implemented yet. Appointment review submission, blind publication, profile summaries, and published profile review lists are part of the current workflow.
- Chat is not part of the current MVP. If added, scope it to an appointment and do not expose private account data.

## Change quality

- Preserve unrelated user changes and never use destructive Git commands.
- Validate proportionally to the change. For application changes, run typecheck, lint, relevant tests, and the production build before handoff.
- Add focused tests for recurrence, DST, appointment state transitions, overlap behavior, and privacy-sensitive response shaping when those areas change.
