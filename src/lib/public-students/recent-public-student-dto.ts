import { studentProfileImageUrl, type StudentProfileImageReference } from "@/lib/student-profile/student-profile-image";

export type RecentPublicStudent = {
  name: string;
  publicSlug: string;
  university: string;
  studyYear: number;
  imageUrl: string | null;
  refreshedAt: string;
  cities: string[];
  treatments: string[];
};

type Profile = {
  user: { name: string };
  publicSlug: string | null;
  university: string;
  studyYear: number;
  profileImage: StudentProfileImageReference | null;
  lastRefreshedAt: Date | null;
};

export function createRecentPublicStudent(
  profile: Profile,
  availability: { cities: Set<string>; treatments: Set<string> },
): RecentPublicStudent | null {
  if (!profile.publicSlug || !profile.lastRefreshedAt) return null;
  // Deliberate allowlist: never spread the database record into a public DTO.
  return {
    name: profile.user.name,
    publicSlug: profile.publicSlug,
    university: profile.university,
    studyYear: profile.studyYear,
    imageUrl: studentProfileImageUrl(profile.profileImage),
    refreshedAt: profile.lastRefreshedAt.toISOString(),
    cities: [...availability.cities].sort((a, b) => a.localeCompare(b, "ro")),
    treatments: [...availability.treatments].sort((a, b) => a.localeCompare(b, "ro")),
  };
}
