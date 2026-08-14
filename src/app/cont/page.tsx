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
import { AppointmentList } from "@/components/appointments/appointment-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  clickableCardClassName,
  clickableCardIndicatorClassName,
  clickableCardLinkClassName,
} from "@/components/ui/clickable-card-styles";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
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

function activeResourceLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string,
) {
  return count === 1 ? `1 ${singularLabel}` : `${count} ${pluralLabel}`;
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
              isActive: true,
              deletedAt: null,
            },
          }),
          prisma.studentLocation.count({
            where: {
              studentProfileId: profile.id,
              isActive: true,
              deletedAt: null,
            },
          }),
          prisma.studentSupervisor.count({
            where: {
              studentProfileId: profile.id,
              isActive: true,
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
          <h1 className="text-3xl font-semibold tracking-tight">
            Bun venit, {session.user.name}
          </h1>
          <p className="text-muted-foreground">
            Aici poți gestiona informațiile și activitatea contului.
          </p>
        </header>

        {studentData ? (
          <section aria-labelledby="professional-profile-title">
            <Card>
              <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
                        <GraduationCap className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 id="professional-profile-title" className="font-semibold">
                          Profil profesional
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Datele profesionale afișate în profilul tău.
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full shrink-0 sm:w-auto"
                    >
                      <Link href="/cont/profil-student">Editează profilul</Link>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                      {profileCompletion}
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {studentData.profile
                        ? compactBio(studentData.profile.bio)
                        : "Completează universitatea, anul de studiu și descrierea profesională."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 md:border-l md:pl-5">
                  {studentData.profile ? (
                    <dl className="grid grid-cols-2 gap-3 text-sm">
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

                {publication ? (
                  <StudentPublicationControl
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
                {activeResourceLabel(
                  studentData.activeTreatments,
                  "tratament activ",
                  "tratamente active",
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
                {activeResourceLabel(
                  studentData.activeLocations,
                  "locație activă",
                  "locații active",
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
                {activeResourceLabel(
                  studentData.activeSupervisors,
                  "supervizor activ",
                  "supervizori activi",
                )}
              </p>
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

        {appointmentData ? (
          <section aria-labelledby="account-appointments-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="account-appointments-title" className="text-xl font-semibold">Programări</h2>
                <p className="text-sm text-muted-foreground">
                  {isStudent ? "Cererile și întâlnirile pacienților tăi." : "Cererile trimise și întâlnirile tale."}
                </p>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/cont/programari">Vezi toate programările</Link></Button>
            </div>
            <AppointmentList
              appointments={appointmentData.appointments.slice(0, 3)}
              role={isStudent ? "STUDENT" : "PATIENT"}
              compact
            />
            {!isStudent && appointmentData.reputation ? (
              <p className="text-xs text-muted-foreground">
                Reputație: {appointmentData.reputation.lateCancellations12Months} anulări confirmate cu mai puțin de 2 ore în ultimele 12 luni.
              </p>
            ) : null}
          </section>
        ) : null}

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
