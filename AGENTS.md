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
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma db seed
```

- The seed upserts the shared treatment and city catalogs. It must not create demo users or appointments.
- Never reset or migrate a database before verifying that `DATABASE_URL` points to the intended local/non-production instance.
- Every Prisma schema change requires a checked-in migration. Do not use `db push` as a substitute for migrations.

## Authentication and authorization

- Better Auth is authoritative for sessions. Enforce role and ownership checks on the server for every private read and write.
- Mutating account APIs must verify the request origin and require a verified email.
- Roles are `PATIENT`, `STUDENT`, and `ADMIN`. Do not trust a role, user ID, profile ID, or ownership field supplied by the client.
- A signed-in student must not see their own listing among `/studenti` search results, although their direct public profile remains accessible.

## Scheduling invariants

- All recurring availability is defined in the `Europe/Bucharest` wall-clock timezone and materialized as UTC instants. Preserve local time across DST transitions and reject nonexistent local times.
- Patients can submit overlapping `PENDING` requests for different slots, but cannot have overlapping `CONFIRMED` appointments.
- A patient can request a slot until its start time. At the start time an unconfirmed request becomes `EXPIRED`.
- Confirming one request atomically marks the patient's other overlapping pending requests as `SUPERSEDED`.
- A slot can have only one active (`PENDING` or `CONFIRMED`) appointment.
- Patients can cancel only before the start time. Students use `COMPLETED` or `NO_SHOW` after the start time.
- Patient cancellation, student rejection, student cancellation, and pending withdrawal require a trimmed reason of 20–500 characters.
- A patient cancellation is late only when the appointment was confirmed and is cancelled less than two hours before its start. Track both rolling-12-month and lifetime counts; do not apply an automatic penalty yet.
- Moving or cancelling an occupied availability occurrence must atomically reject its pending request or cancel its confirmed appointment with a required reason. Never move the patient's appointment to the new time.
- Appointments retain their scheduled time, names, treatment, location, address, supervisor, age, and note snapshots even when the underlying availability or professional resources later change.
- Use serializable transactions and optimistic `version`/`revision` checks for scheduling writes. Database constraints are the final defense against slot and time overlaps.

## Patient data and privacy

- Patient accounts may be created without a date of birth.
- Before the first booking, require and store the date of birth once. Patients must be at least 18 and can correct the date later from their private profile.
- Students receive only the patient's name, age at appointment, current note, aggregate late-cancellation reputation, and appointment history shared with that student.
- Never expose the patient's email, exact date of birth, private profile slug, other providers' appointment details, or unrelated account data to a student.
- Keep public, patient-private, and student-private response DTOs intentionally separate; do not return broad Prisma `include` graphs from APIs.

## Calendar and appointment UX

- FullCalendar is the primary scheduling surface: `timeGridWeek` on larger screens and `timeGridDay` on phones.
- Student events use consistent states: available (green), pending (amber), confirmed (blue), moved exception (violet), and cancelled (muted).
- Drag-and-drop is allowed for movable occurrences. Occupied occurrences require the cancellation-reason flow before the move is committed.
- Patients book by selecting a free event from the public student's calendar. If their birth date is missing, complete that profile step before enabling slot selection.
- Keep accessible labels, keyboard-focus styles, and a non-color status label wherever status is communicated by color.

## Future features

- Completed appointments are designed to support one patient-to-student and one student-to-patient review. The schema exists, but review submission and publication policy are not implemented yet.
- Chat is not part of the current MVP. If added, scope it to an appointment and do not expose private account data.

## Change quality

- Preserve unrelated user changes and never use destructive Git commands.
- Validate proportionally to the change. For application changes, run typecheck, lint, relevant tests, and the production build before handoff.
- Add focused tests for recurrence, DST, appointment state transitions, overlap behavior, and privacy-sensitive response shaping when those areas change.
