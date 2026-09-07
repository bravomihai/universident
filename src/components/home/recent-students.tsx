import { GraduationCap, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Card } from "@/components/ui/card";
import { clickableCardClassName, clickableCardIndicatorClassName, clickableCardLinkClassName } from "@/components/ui/clickable-card-styles";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";
import { getRecentPublicStudents } from "@/lib/public-students/recent-public-students";
import { publicStudentProfileFromHomeHref } from "@/lib/public-students/public-student-profile-navigation";

const refreshedDate = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "Europe/Bucharest" });

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
        <Link href={publicStudentProfileFromHomeHref(profile.publicSlug)} key={profile.publicSlug} className={clickableCardLinkClassName}>
          <Card className={`home-profile-card ${clickableCardClassName}`}>
            <div className="home-profile-top"><ProfileAvatar name={profile.name} imageUrl={profile.imageUrl} className="size-16 text-xl" /><span className="home-study-year">Anul {profile.studyYear}</span></div>
            <h3>{profile.name}</h3>
            <p className="home-profile-meta"><GraduationCap aria-hidden="true" />{profile.university}</p>
            <p className="home-profile-meta"><MapPin aria-hidden="true" />{profile.cities.join(" · ")}</p>
            <div className="home-treatment-tags">{profile.treatments.slice(0, 2).map((treatment) => <span key={treatment}>{treatment}</span>)}</div>
            <div className="home-profile-bottom"><span>Actualizat <time dateTime={profile.refreshedAt}>{refreshedDate.format(new Date(profile.refreshedAt))}</time></span><span className={`home-card-arrow ${clickableCardIndicatorClassName}`} aria-hidden="true">&gt;</span></div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function RecentStudentsLoading() {
  return <p className="home-profile-empty" role="status">Se încarcă profilurile actualizate recent…</p>;
}
