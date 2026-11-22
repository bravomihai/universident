import { PublicStudentProfileCard } from "@/components/public-students/public-student-profile-card";
import type { PublicStudentDirectoryCardData } from "@/lib/public-students/public-student-directory";

import layout from "./public-student-card-layout.module.css";

export function PublicStudentDirectoryGrid({
  students,
  heading,
}: {
  students: PublicStudentDirectoryCardData[];
  heading?: "h2" | "h3";
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {students.map((student) => (
        <li key={student.publicSlug} className={layout.directoryItem}>
          <PublicStudentProfileCard student={student} directory heading={heading} />
        </li>
      ))}
    </ul>
  );
}
