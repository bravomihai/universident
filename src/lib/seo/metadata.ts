import type { Metadata } from "next";
import { canonicalUrl, isPublicDeployment, PUBLIC_SITE_ORIGIN } from "./config";

export const privateRobots = { index: false, follow: false } as const;

export function publicPageMetadata({ title, description, path, indexable = true }: {
  title: string;
  description: string;
  path?: string;
  indexable?: boolean;
}): Metadata {
  return {
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
    title,
    description,
    ...(path ? { alternates: { canonical: canonicalUrl(path) } } : {}),
    robots: { index: isPublicDeployment() && indexable, follow: true },
  };
}

export function homeMetadata() {
  return publicPageMetadata({
    title: "Tratamente dentare cu studenți, sub supervizare",
    description: "Găsește studenți la medicină dentară în orașul tău. Consultă profilurile, tratamentele sub supervizare și orele disponibile pe Universident.",
    path: "/",
  });
}

export function studentProfileMetadata(profile: {
  publicSlug: string | null;
  university: string;
  studyYear: number;
  user: { name: string };
} | null): Metadata {
  if (!profile?.publicSlug) return { title: "Profil indisponibil", robots: privateRobots };
  return publicPageMetadata({
    title: `${profile.user.name} — student la medicină dentară`,
    description: `${profile.user.name}, student în anul ${profile.studyYear} la ${profile.university}. Consultă profilul și tratamentele disponibile sub supervizare pe Universident.`,
    path: `/studenti/${encodeURIComponent(profile.publicSlug)}`,
  });
}
