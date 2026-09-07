import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudentCalendar } from "@/components/student-calendar/student-calendar";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@/lib/prisma";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Calendar și disponibilitate",
  description:
    "Gestionează calendarul, disponibilitatea și cererile pacienților.",
};

export default async function StudentCalendarPage() {
  const session = await requireStudentPageSession();
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!studentProfile) {
    redirect("/cont/profil-student");
  }

  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-3 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[90rem] space-y-6">
        <header className="space-y-4">
          <BackLink href="/cont">Înapoi la cont</BackLink>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Calendar și disponibilitate
                </h1>
              </div>
              <p className="max-w-3xl text-muted-foreground">
                Creează sloturi unice sau recurente și gestionează cererile pacienților.
              </p>
            </div>
          </div>
        </header>

        <StudentCalendar />
      </div>
    </main>
  );
}
