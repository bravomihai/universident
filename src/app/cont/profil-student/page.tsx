import type { Metadata } from "next";
import Link from "next/link";

import { StudentProfileForm } from "@/components/student/student-profile-form";
import { AppointmentList } from "@/components/appointments/appointment-list";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { listAppointmentsForUser } from "@/lib/appointments/appointment-service";
import { UserRole } from "@/generated/prisma/enums";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
    title: "Profil profesional",
    description: "Configurează profilul tău profesional pe Universident.",
};

export default async function StudentProfilePage() {
    const session = await requireStudentPageSession();

    const [profile, appointmentData] = await Promise.all([prisma.studentProfile.findUnique({
        where: {
            userId: session.user.id,
        },
        select: {
            university: true,
            studyYear: true,
            bio: true,
        },
    }), listAppointmentsForUser(session.user.id, UserRole.STUDENT)]);

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

                <section className="space-y-3" aria-labelledby="student-profile-appointments">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div><h2 id="student-profile-appointments" className="text-xl font-semibold">Programările tale</h2><p className="text-sm text-muted-foreground">Cererile pacienților apar numai în contul tău privat.</p></div>
                        <Link href="/cont/programari" className="text-sm font-medium hover:underline">Vezi toate</Link>
                    </div>
                    <AppointmentList appointments={appointmentData.appointments.slice(0, 5)} role="STUDENT" compact />
                </section>
            </div>
        </main>
    );
}
