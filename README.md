# Universident

Universident is a Romanian-language web application that connects adult patients with dentistry students offering supervised care. Students publish the treatments they offer and their real availability; patients search by treatment and city, then request a suitable appointment.

## For whom

- **Patients** looking for dental care from a student.
- **Dentistry students** who need to manage their professional profile and appointments.
- **Dental faculties and clinics** supervising student work.

## What it does

- Student and patient accounts, professional profiles, and authentication.
- Search by treatment and city, with one result per student.
- Student calendars with locations, treatments, supervisors, and bounded recurring availability.
- Appointment requests, confirmation, rejection, cancellation, completion, and no-show reporting.
- Appointment notifications, reputation, and two-way reviews after completed appointments.

## Stack

Next.js, React, TypeScript, PostgreSQL, Prisma, Better Auth, Tailwind CSS, shadcn/Radix UI, FullCalendar, Resend, and the Node.js test runner (via tsx).

## Local development

With `.env` configured from [`.env.example`](.env.example) and the local database prepared, start the development services from the repository root:

```bash
docker compose -f compose-dev.yaml up -d --wait
npm run dev
```

[`compose-dev.yaml`](compose-dev.yaml) runs only PostgreSQL, exposed at `127.0.0.1:5432` with persistent storage. `npm run dev` runs Next.js with hot reload and the chat email worker as local Node.js processes; stopping that command stops both processes. The worker requires `CHAT_WORKER_SECRET` (at least 32 characters) and the configured local application URL. Email delivery also requires `RESEND_API_KEY` and `EMAIL_FROM`.

Use `npm run dev:web` for Next.js alone, or `npm run chat:emails` to start the worker separately when the application is already running. See the [chat guide](docs/chat.md#configuration-and-processes) for worker configuration and delivery behavior.

Stop the local database with:

```bash
docker compose -f compose-dev.yaml stop
```

## Compose environments

The two Compose files are independent configurations, selected explicitly with `-f`:

- [`compose-dev.yaml`](compose-dev.yaml): local PostgreSQL; the application and worker run through npm for development.
- [`compose.production.yaml`](compose.production.yaml): PostgreSQL, the built Next.js application, and a separate chat email worker container, with restart policies, health checks, and production container settings. PostgreSQL is reachable only inside the Docker network. The `migrate` service belongs to the `tools` profile and runs separately during deployment.

Their shared PostgreSQL settings intentionally appear in both files so each environment can run independently. Follow the [deployment guide](docs/deployment.md) for production commands and migration ordering.

## Documentation

See the [documentation index](docs/README.md) for deployment, dependency security, chat, navigation, SEO, and brand assets. Product rules and contribution conventions are in [AGENTS.md](AGENTS.md).
