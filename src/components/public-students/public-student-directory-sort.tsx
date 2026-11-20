"use client";

import { useRouter } from "@/components/navigation/use-app-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseStudentDirectorySort, publicStudentDirectoryHref, studentDirectorySortOptions, type StudentDirectorySort } from "@/lib/public-students/public-student-directory-order";

export function PublicStudentDirectorySort({ sort }: { sort: StudentDirectorySort }) {
  const router = useRouter();

  return (
    <Select
      value={sort}
      onValueChange={(value) => router.push(publicStudentDirectoryHref(1, parseStudentDirectorySort(value)))}
    >
      <SelectTrigger aria-label="Sortează studenții" className="w-full sm:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(studentDirectorySortOptions).map(([value, label]) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
