import {
  Archive,
  ChevronRight,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StudentVerificationStatusBadge } from "@/components/student/student-verification-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
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

const resourceCardLinkClassName =
  "group block cursor-pointer rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function locationSummary(total: number, active: number) {
  const configuredLabel =
    total === 1
      ? "1 locație configurată"
      : `${total} locații configurate`;
  const activeLabel =
    active === 1 ? "1 activă" : `${active} active`;

  return `${configuredLabel} · ${activeLabel}`;
}

function treatmentSummary(total: number, active: number) {
  const configuredLabel =
    total === 1
      ? "1 tratament configurat"
      : `${total} tratamente configurate`;
  const activeLabel =
    active === 1 ? "1 activ" : `${active} active`;

  return `${configuredLabel} · ${activeLabel}`;
}

function archivedSummary(
  archivedLocations: number,
  archivedTreatments: number,
) {
  const locationLabel =
    archivedLocations === 1
      ? "1 locație"
      : `${archivedLocations} locații`;
  const treatmentLabel =
    archivedTreatments === 1
      ? "1 tratament"
      : `${archivedTreatments} tratamente`;

  return `${locationLabel} · ${treatmentLabel}`;
}

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/autentificare");
  }

  const studentData =
    session.user.role === UserRole.STUDENT
      ? await (async () => {
          const profile = await prisma.studentProfile.findUnique({
            where: {
              userId: session.user.id,
            },
            select: {
              id: true,
              university: true,
              studyYear: true,
              verificationStatus: true,
            },
          });

          if (!profile) {
            return {
              profile: null,
              locationCount: 0,
              activeLocationCount: 0,
              treatmentCount: 0,
              activeTreatmentCount: 0,
              archivedLocationCount: 0,
              archivedTreatmentCount: 0,
            };
          }

          const [
            locationCount,
            activeLocationCount,
            treatmentCount,
            activeTreatmentCount,
            archivedLocationCount,
            archivedTreatmentCount,
          ] = await Promise.all([
            prisma.studentLocation.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: null,
              },
            }),
            prisma.studentLocation.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: null,
                isActive: true,
              },
            }),
            prisma.studentTreatment.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: null,
              },
            }),
            prisma.studentTreatment.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: null,
                isActive: true,
              },
            }),
            prisma.studentLocation.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: {
                  not: null,
                },
              },
            }),
            prisma.studentTreatment.count({
              where: {
                studentProfileId: profile.id,
                deletedAt: {
                  not: null,
                },
              },
            }),
          ]);

          return {
            profile,
            locationCount,
            activeLocationCount,
            treatmentCount,
            activeTreatmentCount,
            archivedLocationCount,
            archivedTreatmentCount,
          };
        })()
      : null;

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-5xl space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Contul meu
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Bun venit, {session.user.name}
          </h1>

          <p className="text-muted-foreground">
            Aici poți gestiona informațiile și activitatea contului.
          </p>
        </div>

        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/cont/informatii-cont"
              className={resourceCardLinkClassName}
            >
              <Card className="h-full cursor-pointer transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                <CardHeader>
                  <span className="inline-flex size-9 items-center justify-center rounded-full border bg-muted/30">
                    <UserRound
                      className="size-4"
                      aria-hidden="true"
                    />
                  </span>
                  <CardTitle>Informații despre cont</CardTitle>
                  <CardDescription>
                    Nume, email și datele generale ale contului
                  </CardDescription>
                </CardHeader>

                <CardContent className="mt-auto space-y-4">
                  <div className="space-y-1">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="break-all text-sm text-muted-foreground">
                      {session.user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Rol: {roleLabels[session.user.role]}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    Gestionează informațiile
                    <ChevronRight
                      className="size-4"
                      aria-hidden="true"
                    />
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/cont/securitate"
              className={resourceCardLinkClassName}
            >
              <Card className="h-full cursor-pointer transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                <CardHeader>
                  <span className="inline-flex size-9 items-center justify-center rounded-full border bg-muted/30">
                    <ShieldCheck
                      className="size-4"
                      aria-hidden="true"
                    />
                  </span>
                  <CardTitle>
                    Confidențialitate și securitate
                  </CardTitle>
                  <CardDescription>
                    Parolă, autentificare și recuperarea contului
                  </CardDescription>
                </CardHeader>

                <CardContent className="mt-auto space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Consultă structura viitoarelor opțiuni de
                    protecție și confidențialitate.
                  </p>

                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    Gestionează securitatea
                    <ChevronRight
                      className="size-4"
                      aria-hidden="true"
                    />
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>

          {studentData ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Link
                  href="/cont/profil-student"
                  aria-label="Deschide profilul profesional"
                  className={resourceCardLinkClassName}
                >
                  <Card className="h-full transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                    <CardHeader>
                      <span className="inline-flex size-9 items-center justify-center rounded-full border bg-muted/30">
                        <GraduationCap
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                      <CardTitle>Profil profesional</CardTitle>
                      <CardDescription>
                        Universitate, an de studiu, descriere și
                        verificare.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto space-y-4">
                      {studentData.profile ? (
                        <div className="space-y-2">
                          <p className="font-medium">
                            {studentData.profile.university} · Anul{" "}
                            {studentData.profile.studyYear}
                          </p>
                          <StudentVerificationStatusBadge
                            status={
                              studentData.profile.verificationStatus
                            }
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Profilul profesional nu este completat
                          încă.
                        </p>
                      )}

                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        {studentData.profile
                          ? "Editează profilul"
                          : "Completează profilul"}
                        <ChevronRight
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                    </CardContent>
                  </Card>
                </Link>

                <Link
                  href="/cont/locatii"
                  aria-label="Deschide administrarea locațiilor"
                  className={resourceCardLinkClassName}
                >
                  <Card className="h-full transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                    <CardHeader>
                      <span className="inline-flex size-9 items-center justify-center rounded-full border bg-muted/30">
                        <MapPin
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                      <CardTitle>Locații</CardTitle>
                      <CardDescription>
                        Locurile în care poți primi pacienți.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto space-y-4">
                      <p className="font-medium">
                        {locationSummary(
                          studentData.locationCount,
                          studentData.activeLocationCount,
                        )}
                      </p>

                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        Gestionează locațiile
                        <ChevronRight
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                    </CardContent>
                  </Card>
                </Link>

                <Link
                  href="/cont/tratamente"
                  aria-label="Deschide administrarea tratamentelor"
                  className={resourceCardLinkClassName}
                >
                  <Card className="h-full transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35">
                    <CardHeader>
                      <span className="inline-flex size-9 items-center justify-center rounded-full border bg-muted/30">
                        <Stethoscope
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                      <CardTitle>Tratamente</CardTitle>
                      <CardDescription>
                        Serviciile oferite și locațiile asociate.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto space-y-4">
                      <p className="font-medium">
                        {treatmentSummary(
                          studentData.treatmentCount,
                          studentData.activeTreatmentCount,
                        )}
                      </p>

                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        Gestionează tratamentele
                        <ChevronRight
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              <Link
                href="/cont/arhivate"
                aria-label="Deschide resursele arhivate"
                className={resourceCardLinkClassName}
              >
                <Card
                  size="sm"
                  className="cursor-pointer transition group-hover:ring-primary/35 group-focus-visible:ring-primary/35"
                >
                  <CardHeader>
                    <span className="inline-flex size-8 items-center justify-center rounded-full border bg-background">
                      <Archive
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    </span>
                    <CardTitle className="text-sm">
                      Resurse arhivate
                    </CardTitle>
                    <CardDescription>
                      Locațiile și tratamentele păstrate pentru
                      restaurare.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="font-medium">
                      {archivedSummary(
                        studentData.archivedLocationCount,
                        studentData.archivedTreatmentCount,
                      )}
                    </p>

                    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                      Vezi resursele arhivate
                      <ChevronRight
                        className="size-4"
                        aria-hidden="true"
                      />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
