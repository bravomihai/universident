import {
  Archive,
  CalendarDays,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { StudentPublicationControl } from "@/components/student/student-publication-control";
import { Card, CardContent } from "@/components/ui/card";
import {
  clickableCardClassName,
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { appointmentNeedsAttention } from "@/lib/appointments/appointment-presentation";
import { formatLateCancellationReputation } from "@/lib/appointments/patient-reputation-label";
import { prisma } from "@/lib/prisma";
import { getStudentPublicationReadiness } from "@/lib/student-publication/student-publication-readiness";

export const metadata: Metadata = {
  title: "Contul meu",
  description: "Gestionează contul tău Universident.",
};

const roleLabels: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Pacient",
  [UserRole.STUDENT]: "Student",
  [UserRole.ADMIN]: "Administrator",
};

type DashboardLinkCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  children: ReactNode;
};

function DashboardLinkCard({
  href,
  icon: Icon,
  title,
  description,
  action,
  children,
}: DashboardLinkCardProps) {
  return (
    <Link href={href} className={clickableCardLinkClassName}>
      <Card className={clickableCardClassName}>
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="text-sm">{children}</div>

          <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium">
            {action}
            <span
              className={clickableCardIndicatorClassName}
              aria-hidden="true"
            >
              {">"}
            </span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function resourceCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string,
) {
  return count === 1 ? `1 ${singularLabel}` : `${count} ${pluralLabel}`;
}

function compactBio(bio: string | null) {
  if (!bio?.trim()) return "Adaugă o scurtă descriere profesională.";
  const normalized = bio.trim().replace(/\s+/g, " ");
  return normalized.length > 180
    ? `${normalized.slice(0, 177).trimEnd()}...`
    : normalized;
}

export default async function AccountPage() {
  const session = await requireAccountPageSession();
  const isStudent = session.user.role === UserRole.STUDENT;
  const appointmentData =
    session.user.role === UserRole.PATIENT || session.user.role === UserRole.STUDENT
      ? await listAppointmentsForUser(session.user.id, session.user.role)
      : null;
  const appointmentRole = isStudent ? "STUDENT" : "PATIENT";
  const appointmentsNeedingAttention = appointmentData
    ? appointmentData.appointments.filter((appointment) =>
        appointmentNeedsAttention(appointment, appointmentRole),
      ).length
    : 0;

  const studentData = isStudent
    ? await (async () => {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: {
            id: true,
            university: true,
            studyYear: true,
            bio: true,
          },
        });

        if (!profile) {
          return {
            profile: null,
            activeTreatments: 0,
            activeLocations: 0,
            activeSupervisors: 0,
            archivedTreatments: 0,
            archivedLocations: 0,
            archivedSupervisors: 0,
          };
        }

        const [
          activeTreatments,
          activeLocations,
          activeSupervisors,
          archivedTreatments,
          archivedLocations,
          archivedSupervisors,
        ] = await Promise.all([
          prisma.studentTreatment.count({
            where: {
              studentProfileId: profile.id,
              deletedAt: null,
            },
          }),
          prisma.studentLocation.count({
            where: {
              studentProfileId: profile.id,
              deletedAt: null,
            },
          }),
          prisma.studentSupervisor.count({
            where: {
              studentProfileId: profile.id,
              deletedAt: null,
            },
          }),
          prisma.studentTreatment.count({
            where: { studentProfileId: profile.id, deletedAt: { not: null } },
          }),
          prisma.studentLocation.count({
            where: { studentProfileId: profile.id, deletedAt: { not: null } },
          }),
          prisma.studentSupervisor.count({
            where: { studentProfileId: profile.id, deletedAt: { not: null } },
          }),
        ]);

        return {
          profile,
          activeTreatments,
          activeLocations,
          activeSupervisors,
          archivedTreatments,
          archivedLocations,
          archivedSupervisors,
        };
      })()
    : null;

  const profileCompletion = !studentData?.profile
    ? "Profil necompletat"
    : studentData.profile.bio?.trim()
      ? "Profil complet"
      : "Profil parțial";
  const publication = isStudent
    ? await getStudentPublicationReadiness(session.user.id)
    : null;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Contul meu
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              Bun venit, {session.user.name}
            </h1>
          </div>
          <p className="text-muted-foreground">
            Aici poți gestiona informațiile și activitatea contului.
          </p>
        </header>

        {studentData ? (
          <section aria-label="Profil profesional" className="space-y-8">
            <DashboardLinkCard
              href="/cont/profil-student"
              icon={GraduationCap}
              title="Profil profesional"
              description="Datele profesionale afișate în profilul tău."
              action="Editează profilul"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                      {profileCompletion}
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {studentData.profile
                        ? compactBio(studentData.profile.bio)
                        : "Completează universitatea, anul de studiu și descrierea profesională."}
                    </p>
                </div>
                {studentData.profile ? (
                  <dl className="grid grid-cols-2 gap-4 text-sm sm:border-l sm:pl-5">
                    <div>
                      <dt className="text-xs text-muted-foreground">Universitate</dt>
                      <dd className="font-medium">{studentData.profile.university}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">An de studiu</dt>
                      <dd className="font-medium">Anul {studentData.profile.studyYear}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </DashboardLinkCard>

            <div className="grid gap-8 md:grid-cols-2 md:gap-4">
              <Card>
                <CardContent className="h-full p-5">
                {publication ? (
                  <StudentPublicationControl
                    className="h-full border-t-0 pt-0"
                    initialState={{
                      isPublished: publication.isPublished,
                      isPubliclyVisible: publication.isPubliclyVisible,
                      canPublish: publication.canPublish,
                      publicPath: publication.publicSlug
                        ? `/studenti/${publication.publicSlug}`
                        : null,
                      missingRequirements: publication.missingRequirements,
                    }}
                  />
                ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                      <UserRound className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h2 id="account-details-title" className="font-semibold">
                        Detalii cont
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Datele contului sunt disponibile doar pentru consultare.
                      </p>
                    </div>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Nume</dt>
                      <dd className="truncate font-medium" title={session.user.name}>
                        {session.user.name}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="truncate font-medium" title={session.user.email}>
                        {session.user.email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Rol</dt>
                      <dd className="font-medium">{roleLabels[session.user.role]}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : null}

        {appointmentData ? (
          <section aria-label="Programările contului" className="grid gap-4">
            <DashboardLinkCard
              href="/cont/programari"
              icon={CalendarDays}
              title="Programările mele"
              description={isStudent ? "Cererile și întâlnirile pacienților tăi." : "Cererile trimise și întâlnirile tale."}
              action="Vezi programările"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {appointmentData.appointments.length === 1
                    ? "O cerere sau programare în istoric"
                    : `${appointmentData.appointments.length} cereri și programări în istoric`}
                </p>
                {appointmentsNeedingAttention ? (
                  <p className="text-orange-700 dark:text-orange-300">Necesită atenția ta: {appointmentsNeedingAttention}</p>
                ) : null}
                {!isStudent && appointmentData.reputation ? (
                  <p className="text-muted-foreground">
                    {formatLateCancellationReputation(appointmentData.reputation.lateCancellationsLast10)}
                  </p>
                ) : null}
              </div>
            </DashboardLinkCard>
          </section>
        ) : null}

        {studentData ? (
          <section aria-label="Calendar și disponibilitate">
            <Link href="/cont/calendar" className={clickableCardLinkClassName}>
              <Card className={clickableCardClassName}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                      <CalendarDays className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-semibold">Calendar și disponibilitate</h2>
                      <p className="text-sm text-muted-foreground">
                        Organizează sloturile în care poți primi pacienți.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:ml-auto sm:shrink-0 sm:justify-end">
                    <span className="rounded-full border bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
                      Date reale
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      Deschide calendarul
                      <span
                        className={clickableCardIndicatorClassName}
                        aria-hidden="true"
                      >
                        {">"}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </section>
        ) : null}

        {studentData ? (
          <section
            aria-label="Administrare profesională"
            className="grid gap-8 md:grid-cols-3 md:gap-4"
          >
            <DashboardLinkCard
              href="/cont/tratamente"
              icon={Stethoscope}
              title="Tratamente"
              description="Serviciile oferite și asocierile lor."
              action="Gestionează tratamentele"
            >
              <p className="font-medium">
                {resourceCountLabel(
                  studentData.activeTreatments,
                  "tratament",
                  "tratamente",
                )}
              </p>
            </DashboardLinkCard>
            <DashboardLinkCard
              href="/cont/locatii"
              icon={MapPin}
              title="Locații"
              description="Locurile în care poți primi pacienți."
              action="Gestionează locațiile"
            >
              <p className="font-medium">
                {resourceCountLabel(
                  studentData.activeLocations,
                  "locație",
                  "locații",
                )}
              </p>
            </DashboardLinkCard>
            <DashboardLinkCard
              href="/cont/supervizori"
              icon={UsersRound}
              title="Supervizori"
              description="Profesorii disponibili pentru asocieri."
              action="Gestionează supervizorii"
            >
              <p className="font-medium">
                {resourceCountLabel(
                  studentData.activeSupervisors,
                  "supervizor",
                  "supervizori",
                )}
              </p>
            </DashboardLinkCard>
          </section>
        ) : null}

        {!isStudent ? (
          <section
            aria-label="Administrarea contului"
            className="grid gap-4 md:grid-cols-2"
          >
          <DashboardLinkCard
            href="/cont/informatii-cont"
            icon={UserRound}
            title="Informații despre cont"
            description="Identitatea și datele generale ale contului."
            action="Gestionează informațiile"
          >
            <div className="space-y-1">
              <p className="font-medium">{session.user.name}</p>
              <p className="break-all text-muted-foreground">{session.user.email}</p>
              <p className="text-muted-foreground">
                Rol: {roleLabels[session.user.role]}
              </p>
            </div>
          </DashboardLinkCard>
          <DashboardLinkCard
            href="/cont/securitate"
            icon={ShieldCheck}
            title="Confidențialitate și securitate"
            description="Parolă, sesiuni și recuperarea contului."
            action="Gestionează securitatea"
          >
            <p className="font-medium">Protecția contului</p>
          </DashboardLinkCard>
          </section>
        ) : null}

        {studentData ? (
          <section aria-label="Resurse arhivate">
            <DashboardLinkCard
              href="/cont/resurse-arhivate"
              icon={Archive}
              title="Resurse arhivate"
              description="Tratamente, locații și supervizori păstrați pentru restaurare."
              action="Vezi resursele arhivate"
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  {resourceCountLabel(
                    studentData.archivedTreatments,
                    "tratament",
                    "tratamente",
                  )}
                </span>
                <span>
                  {resourceCountLabel(
                    studentData.archivedLocations,
                    "locație",
                    "locații",
                  )}
                </span>
                <span>
                  {resourceCountLabel(
                    studentData.archivedSupervisors,
                    "supervizor",
                    "supervizori",
                  )}
                </span>
              </div>
            </DashboardLinkCard>
          </section>
        ) : null}
      </div>
    </main>
  );
}
