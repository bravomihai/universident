import { unstable_rethrow } from "next/navigation";
import { PublicStudentDirectoryGrid } from "@/components/public-students/public-student-directory-grid";
import { Card, CardContent } from "@/components/ui/card";
import { listPublicStudentDirectory } from "@/lib/public-students/public-student-directory";

const HOME_STUDENT_LIMIT = 8;

export async function RecentStudents({ excludedUserId }: { excludedUserId?: string }) {
  let directory;
  try {
    directory = await listPublicStudentDirectory({ page: 1, sort: "recent", excludedUserId });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Home public profiles unavailable:", error instanceof Error ? error.name : "UnknownError");
    return <p className="home-profile-empty">Profilurile nu se pot încărca momentan.</p>;
  }

  if (!directory.results.length) {
    return (
      <Card className="border-dashed bg-muted/15">
        <CardContent className="py-6 text-center text-muted-foreground">
          Momentan nu există profiluri publicate.
        </CardContent>
      </Card>
    );
  }

  return <PublicStudentDirectoryGrid students={directory.results.slice(0, HOME_STUDENT_LIMIT)} heading="h3" />;
}

export function RecentStudentsLoading() {
  return <p className="home-profile-empty" role="status">Se încarcă profilurile…</p>;
}
