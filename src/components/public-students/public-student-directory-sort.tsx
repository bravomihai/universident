"use client";

import { useRouter } from "@/components/navigation/use-app-router";
import { parseStudentDirectorySort, publicStudentDirectoryHref, studentDirectorySortOptions, type StudentDirectorySort } from "@/lib/public-students/public-student-directory-order";

export function PublicStudentDirectorySort({ sort }: { sort: StudentDirectorySort }) {
  const router = useRouter();

  return (
    <select
      aria-label="Sortează studenții"
      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto"
      value={sort}
      onChange={(event) => router.push(publicStudentDirectoryHref(1, parseStudentDirectorySort(event.currentTarget.value)))}
    >
      {Object.entries(studentDirectorySortOptions).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
