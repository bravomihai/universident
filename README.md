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

With Make installed, `.env` configured from [`.env.example`](.env.example), and dependencies installed with `npm ci`, run this command from the repository root:

```bash
make dev
```

On Linux or WSL, `make dev` starts PostgreSQL at `127.0.0.1:5432`, applies pending Prisma migrations to the local Compose database, seeds the treatment, city, and university catalogs, then runs Next.js with hot reload and the chat email worker in the background. Running it again restarts all three and retains the PostgreSQL volume. Use `make dev-stop` to stop them and `.local-dev/app.log` to inspect application and worker logs. A custom `DATABASE_URL` outside the local Compose database requires separately managed migrations and catalog seeding.

The worker requires `CHAT_WORKER_SECRET` (at least 32 characters) and the configured local application URL. Email delivery also requires `RESEND_API_KEY` and `EMAIL_FROM`. Use `npm run dev` to run Next.js and the worker in the foreground with an already running database.

Use `npm run dev:web` for Next.js alone, or `npm run chat:emails` to start the worker separately when the application is already running. See the [chat guide](docs/chat.md#configuration-and-processes) for worker configuration and delivery behavior.

## Compose environments

Docker Compose automatically finds [`compose.yaml`](compose.yaml). Select the environment with `--profile dev` or `--profile prod`. Each environment uses its own PostgreSQL volume. If you have local data from the old development configuration, export it from the old database and import it into the new development database.

On the production host, `make prod` builds the production images, starts PostgreSQL on the internal Docker network, applies migrations if the Prisma schema is empty, checks migration status, and starts Next.js and the chat email worker. The [deployment guide](docs/deployment.md#manual-production-start) covers configuration and migration ordering.

## Documentation

See the [documentation index](docs/README.md) for deployment, dependency security, chat, navigation, SEO, and brand assets. Product rules and contribution conventions are in [AGENTS.md](AGENTS.md).
