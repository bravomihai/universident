import { RefreshCw } from "lucide-react";
import Link from "@/components/navigation/app-link";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { PublicStudentProfileCard } from "@/components/public-students/public-student-profile-card";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";
import { getRecentPublicStudents } from "@/lib/public-students/recent-public-students";

export async function RecentStudents() {
  const requestHeaders = await headers();
  let profiles;
  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    profiles = await getRecentPublicStudents(session?.user.role === UserRole.STUDENT ? session.user.id : undefined);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Recent public profiles unavailable:", error instanceof Error ? error.name : "UnknownError");
    return <p className="home-profile-empty">Profilurile nu se pot încărca momentan. <Link href="/studenti">Încearcă o căutare &gt;</Link></p>;
  }
  if (!profiles.length) {
    return <div className="home-profile-empty"><RefreshCw className="size-5" aria-hidden="true" /><p>Profilurile actualizate cu intervale disponibile vor apărea aici.</p><Link href="/studenti">Caută după tratament și oraș &gt;</Link></div>;
  }
  return (
    <div className="home-profiles-grid">
      {profiles.map((profile) => (
        <PublicStudentProfileCard
          key={profile.publicSlug}
          student={{ ...profile, treatments: profile.treatments.slice(0, 2) }}
        />
      ))}
    </div>
  );
}

export function RecentStudentsLoading() {
  return <p className="home-profile-empty" role="status">Se încarcă profilurile actualizate recent…</p>;
}
