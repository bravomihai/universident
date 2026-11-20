import { PublicStudentProfileCard } from "@/components/public-students/public-student-profile-card";
import type { PublicStudentDirectoryCardData } from "@/lib/public-students/public-student-directory";

export function PublicStudentDirectoryGrid({
  students,
  heading,
}: {
  students: PublicStudentDirectoryCardData[];
  heading?: "h2" | "h3";
}) {
  return (
    <ul className="grid gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {students.map((student) => (
        <li key={student.publicSlug}>
          <PublicStudentProfileCard student={student} directory heading={heading} />
        </li>
      ))}
    </ul>
  );
}
