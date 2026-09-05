import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";

import { StudentProfileForm } from "@/components/student/student-profile-form";
import { StudentProfileImageForm } from "@/components/student/student-profile-image-form";
import { StudentProfileRefreshControl } from "@/components/student/student-profile-refresh-control";
import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import { SchedulingReputationCard } from "@/components/reviews/scheduling-reputation-card";
import { BackLink } from "@/components/ui/back-link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { formatStudentCancellationReputation } from "@/lib/appointments/student-reputation-label";
import { prisma } from "@/lib/prisma";
import { getPublishedProfileReviews } from "@/lib/reviews/profile-review-service";
import { requireStudentPageSession } from "@/lib/student/student-page-session";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";

export const metadata: Metadata = {
    title: "Profil profesional",
    description: "Configurează profilul tău profesional pe Universident.",
};

const legacyUniversitySlugs: Record<string, string> = {
    "umf cluj": "umf-iuliu-hatieganu-cluj-napoca",
};

function normalizeUniversityName(value: string) {
    return value.trim().toLocaleLowerCase("ro-RO").replace(/\s+/g, " ");
}

export default async function StudentProfilePage() {
    const session = await requireStudentPageSession();

    const [profile, reviewData, universities, appointmentData] = await Promise.all([
        prisma.studentProfile.findUnique({
            where: {
                userId: session.user.id,
            },
            select: {
                university: true,
                studyYear: true,
                bio: true,
                isPublished: true,
                lastRefreshedAt: true,
                profileImage: {
                    select: { id: true, updatedAt: true },
                },
            },
        }),
        getPublishedProfileReviews(session.user.id, "STUDENT"),
        prisma.university.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { shortName: "asc" }],
            select: {
                slug: true,
                shortName: true,
                fullName: true,
            },
        }),
        listAppointmentsForUser(session.user.id, UserRole.STUDENT),
    ]);
    const normalizedProfileUniversity = profile?.university
        ? normalizeUniversityName(profile.university)
        : null;
    const initialUniversitySlug = normalizedProfileUniversity
        ? universities.find(
            (university) =>
                normalizeUniversityName(university.shortName) ===
                normalizedProfileUniversity,
        )?.slug ?? legacyUniversitySlugs[normalizedProfileUniversity] ?? null
        : null;
    const initialImageUrl = studentProfileImageUrl(profile?.profileImage);
    const initialNow = new Date().toISOString();

    return (
        <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
            <div className="w-full max-w-6xl space-y-6">
                <BackLink href="/cont">Înapoi la cont</BackLink>

                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
                            <GraduationCap className="size-5" aria-hidden="true" />
                        </span>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Date generale
                        </h1>
                    </div>

                    <p className="text-muted-foreground">
                        Gestionează informațiile profesionale valabile pentru
                        toate locațiile și tratamentele tale.
                    </p>
                    <RatingSummaryLink summary={reviewData.summary} href="#recenzii" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Fotografie de profil</CardTitle>
                        <CardDescription>
                            Fotografia apare în rezultate și pe profilul tău
                            public. Dacă nu adaugi una, vor fi afișate
                            inițialele numelui.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <StudentProfileImageForm
                            name={session.user.name}
                            hasProfile={Boolean(profile)}
                            initialImageUrl={initialImageUrl}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Informații profesionale</CardTitle>

                        <CardDescription>
                            Completează universitatea, anul de studiu și o
                            scurtă descriere profesională.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <StudentProfileForm
                            initialName={session.user.name}
                            initialProfile={
                                profile
                                    ? {
                                        universitySlug: initialUniversitySlug,
                                        studyYear: profile.studyYear,
                                        bio: profile.bio,
                                    }
                                    : null
                            }
                            universities={universities}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Poziția în rezultate</CardTitle>
                        <CardDescription>
                            Actualizează manual profilul pentru a indica
                            pacienților că informațiile sunt încă actuale.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <StudentProfileRefreshControl
                            hasProfile={Boolean(profile)}
                            isPublished={profile?.isPublished ?? false}
                            initialLastRefreshedAt={
                                profile?.lastRefreshedAt?.toISOString() ?? null
                            }
                            initialNow={initialNow}
                        />
                    </CardContent>
                </Card>

                <SchedulingReputationCard
                    description="Reper calculat din ultimele 10 programări confirmate."
                    value={formatStudentCancellationReputation(
                        appointmentData.studentReputation?.cancellationsLast10 ?? 0,
                    )}
                />

                <ProfileReviewList data={reviewData} title="Recenziile tale" />
            </div>
        </main>
    );
}
