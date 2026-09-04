import {
  Archive,
  CalendarDays,
  GraduationCap,
  MapPin,
  Stethoscope,
  User,
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
import { formatUnreadAppointmentNotifications } from "@/lib/appointments/appointment-notification-label";
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
  actionOnDesktop?: boolean;
  emphasized?: boolean;
  prefetch?: boolean;
  status?: string;
  statusVariant?: "default" | "success";
  children: ReactNode;
};

function DashboardLinkCard({
  href,
  icon: Icon,
  title,
  description,
  action,
  actionOnDesktop = false,
  emphasized = false,
  prefetch,
  status,
  statusVariant = "default",
  children,
}: DashboardLinkCardProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={clickableCardLinkClassName}
    >
      <Card
        className={`${clickableCardClassName} ${emphasized ? "bg-primary/[0.04] ring-primary/30" : ""
          }`}
      >
        <CardContent
          className={`relative flex h-full flex-col gap-4 p-5 ${actionOnDesktop ? "sm:pr-56" : ""
            }`}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {status ? (
              <span
                className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusVariant === "success"
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted/30"
                  }`}
              >
                {status}
              </span>
            ) : null}
          </div>

          <div className="text-sm">{children}</div>

          <span
            className={`mt-auto inline-flex items-center gap-1 text-sm font-medium ${actionOnDesktop
              ? "sm:absolute sm:right-5 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2"
              : ""
              }`}
          >
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

      const activeTreatments = await prisma.studentTreatment.count({
        where: {
          studentProfileId: profile.id,
          deletedAt: null,
        },
      });
      const activeLocations = await prisma.studentLocation.count({
        where: {
          studentProfileId: profile.id,
          deletedAt: null,
        },
      });
      const activeSupervisors = await prisma.studentSupervisor.count({
        where: {
          studentProfileId: profile.id,
          deletedAt: null,
        },
      });
      const archivedTreatments = await prisma.studentTreatment.count({
        where: { studentProfileId: profile.id, deletedAt: { not: null } },
      });
      const archivedLocations = await prisma.studentLocation.count({
        where: { studentProfileId: profile.id, deletedAt: { not: null } },
      });
      const archivedSupervisors = await prisma.studentSupervisor.count({
        where: { studentProfileId: profile.id, deletedAt: { not: null } },
      });

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
    : "Profil complet";
  const publication = isStudent
    ? await getStudentPublicationReadiness(session.user.id)
    : null;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-4">
        <header className="space-y-2 pb-4">
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
          <section aria-label="Profil profesional" className="space-y-4">
            <DashboardLinkCard
              href="/cont/profil-student"
              icon={GraduationCap}
              title="Profil profesional"
              description="Datele profesionale afișate în profilul tău."
              action="Editează profilul"
              status={profileCompletion}
              statusVariant={
                profileCompletion === "Profil complet" ? "success" : "default"
              }
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0 space-y-2">
                  <p className="font-semibold">{session.user.name}</p>
                  <div className="min-w-0">
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {studentData.profile
                        ? compactBio(studentData.profile.bio)
                        : "Completează universitatea, anul de studiu și descrierea profesională."}
                    </p>
                  </div>
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

            <div className="grid gap-4 md:grid-cols-2">
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

              <DashboardLinkCard
                href="/cont/securitate"
                icon={UserRound}
                title="Securitatea contului"
                description="Gestionează datele de autentificare și securitatea contului."
                action="Gestionează securitatea"
              >
                <dl className="grid gap">
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="truncate font-medium" title={session.user.email}>
                      {session.user.email}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-muted-foreground">Rol</dt>
                    <dd className="font-medium">
                      {roleLabels[session.user.role]}
                    </dd>
                  </div>
                </dl>
              </DashboardLinkCard>

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
              actionOnDesktop
              emphasized={appointmentData.unreadNotificationCount > 0}
              prefetch={false}
            >
              <div className="space-y-1">
                <p
                  className={
                    appointmentData.unreadNotificationCount > 0
                      ? "font-semibold text-primary"
                      : "font-medium"
                  }
                >
                  {formatUnreadAppointmentNotifications(
                    appointmentData.unreadNotificationCount,
                  )}
                </p>
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
            className="grid gap-4 md:grid-cols-3"
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

        {!isStudent && appointmentData ? (
          <section
            aria-label="Profil și detalii cont"
            className="grid gap-4 md:grid-cols-2"
          >
            <DashboardLinkCard
              href="/cont/profil-pacient"
              icon={UserRound}
              title="Profil pacient"
              description="Datele profilului și recenziile tale."
              action="Editează profilul"
              status={
                appointmentData.patientProfile?.dateOfBirth
                  ? "Profil complet"
                  : "Profil incomplet"
              }
              statusVariant={
                appointmentData.patientProfile?.dateOfBirth
                  ? "success"
                  : "default"
              }
            >
              <div className="space-y-2">
                <p className="font-semibold">{session.user.name}</p>
                <p className="text-muted-foreground">
                  {appointmentData.patientProfile?.bio?.trim()
                    ? compactBio(appointmentData.patientProfile.bio)
                    : "Poți adăuga o descriere opțională pentru studenții cu care ai o programare."}
                </p>
              </div>
            </DashboardLinkCard>

            <DashboardLinkCard
              href="/cont/securitate"
              icon={UserRound}
              title="Securitatea contului"
              description="Gestionează datele de autentificare și securitatea contului."
              action="Gestionează securitatea"
            >
              <dl className="grid gap">
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium" title={session.user.email}>
                    {session.user.email}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground">Rol</dt>
                  <dd className="font-medium">
                    {roleLabels[session.user.role]}
                  </dd>
                </div>
              </dl>
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
              actionOnDesktop
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
