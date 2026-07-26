import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { StudentProfileForm } from "@/components/student/student-profile-form";
import { StudentVerificationStatusBadge } from "@/components/student/student-verification-status-badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    StudentVerificationStatus,
    UserRole,
} from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
    title: "Profil profesional",
    description: "Configurează profilul tău profesional pe Universident.",
};

export default async function StudentProfilePage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/autentificare");
    }

    if (session.user.role !== UserRole.STUDENT) {
        redirect("/cont");
    }

    const profile = await prisma.studentProfile.findUnique({
        where: {
            userId: session.user.id,
        },
        select: {
            university: true,
            studyYear: true,
            bio: true,
            verificationStatus: true,
        },
    });

    const verificationStatus =
        profile?.verificationStatus ??
        StudentVerificationStatus.NOT_SUBMITTED;

    return (
        <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
            <div className="w-full max-w-3xl space-y-6">
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
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Statusul verificării</CardTitle>

                        <CardDescription>
                            Verificarea administrativă este separată de
                            configurarea locațiilor și tratamentelor.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <StudentVerificationStatusBadge
                            status={verificationStatus}
                            showDescription
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
                        <StudentProfileForm initialProfile={profile} />
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
