import type { Metadata } from "next";
import Link from "next/link";

import { StudentProfileForm } from "@/components/student/student-profile-form";
import { ProfileReviewList } from "@/components/reviews/profile-review-list";
import { RatingSummaryLink } from "@/components/reviews/rating-summary";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getPublishedProfileReviews } from "@/lib/reviews/profile-review-service";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
    title: "Profil profesional",
    description: "Configurează profilul tău profesional pe Universident.",
};

export default async function StudentProfilePage() {
    const session = await requireStudentPageSession();

    const [profile, reviewData] = await Promise.all([prisma.studentProfile.findUnique({
        where: {
            userId: session.user.id,
        },
        select: {
            university: true,
            studyYear: true,
            bio: true,
        },
    }), getPublishedProfileReviews(session.user.id, "STUDENT")]);

    return (
        <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
            <div className="w-full max-w-6xl space-y-6">
                <Link
                    href="/cont"
                    className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                    ← Înapoi la cont
                </Link>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        Profil profesional
                    </p>

                    <h1 className="text-3xl font-semibold tracking-tight">
                        Date generale
                    </h1>

                    <p className="text-muted-foreground">
                        Gestionează informațiile profesionale valabile pentru
                        toate locațiile și tratamentele tale.
                    </p>
                    <RatingSummaryLink summary={reviewData.summary} href="#recenzii" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Informații profesionale</CardTitle>

                        <CardDescription>
                            Completează universitatea, anul de studiu și o
                            scurtă descriere profesională.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <StudentProfileForm initialProfile={profile} />
                    </CardContent>
                </Card>

                <ProfileReviewList data={reviewData} title="Recenziile tale" />
            </div>
        </main>
    );
}
