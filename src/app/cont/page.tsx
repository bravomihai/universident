import {
  Archive,
  ChevronRight,
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

import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Contul meu",
  description: "Gestionează contul tău Universident.",
};

const roleLabels: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Pacient",
  [UserRole.STUDENT]: "Student",
  [UserRole.ADMIN]: "Administrator",
};

const dashboardLinkClassName =
  "group block h-full rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
    <Link href={href} className={dashboardLinkClassName}>
      <Card className="h-full transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
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

          <div className="mt-auto text-sm">{children}</div>

          <span className="inline-flex items-center gap-1 text-sm font-medium">
            {action}
            <ChevronRight className="size-4" aria-hidden="true" />
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
            <Link
              href="/cont/profil-student"
              className={dashboardLinkClassName}
            >
              <Card className="transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
                        <GraduationCap className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 id="professional-profile-title" className="font-semibold">
                          Profil profesional
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Datele profesionale afișate în profilul tău.
                        </p>
                      </div>
                      <span className="ml-auto rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                        {profileCompletion}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {studentData.profile
                        ? compactBio(studentData.profile.bio)
                        : "Completează universitatea, anul de studiu și descrierea profesională."}
                    </p>
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
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      Editează profilul profesional
                      <ChevronRight className="size-4" aria-hidden="true" />
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
          <section aria-labelledby="archived-resources-title">
            <Link
              href="/cont/resurse-arhivate"
              className={dashboardLinkClassName}
            >
              <Card className="transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                    <Archive className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="archived-resources-title" className="font-semibold">
                      Resurse arhivate
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Tratamente, locații și supervizori păstrați pentru restaurare.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
