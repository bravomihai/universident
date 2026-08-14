import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StudentCalendar } from "@/components/student-calendar/student-calendar";
import { requireStudentPageSession } from "@/lib/student/student-page-session";

export const metadata: Metadata = {
  title: "Calendar și disponibilitate",
  description:
    "Gestionează calendarul, disponibilitatea și cererile pacienților.",
};

export default async function StudentCalendarPage() {
  await requireStudentPageSession();

  return (
    <main className="flex flex-1 justify-center px-3 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[90rem] space-y-6">
        <header className="space-y-4">
          <Link
            href="/cont"
            className="inline-flex rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Contul meu
          </Link>
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
            <span className="w-fit rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">Europe/Bucharest</span>
          </div>
        </header>

        <StudentCalendar />
      </div>
    </main>
  );
}
