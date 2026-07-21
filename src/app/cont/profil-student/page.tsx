import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { StudentProfileForm } from "@/components/student/student-profile-form";
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
    title: "Profil de student",
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
            city: true,
            bio: true,
            isPublished: true,
        },
    });

    return (
        <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
            <div className="w-full max-w-3xl space-y-4">
                <Link
                    href="/cont"
                    className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                    ← Înapoi la cont
                </Link>

                <Card>
                    <CardHeader>
                        <CardTitle>Profilul de student</CardTitle>

                        <CardDescription>
                            Completează informațiile care vor apărea în profilul tău
                            profesional.
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