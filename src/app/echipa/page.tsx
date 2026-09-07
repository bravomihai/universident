import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Echipa",
  robots: { index: false, follow: true },
};

export default function TeamPage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="team-intro w-full max-w-6xl">
        {/* Fotografiile și prezentările creatorilor vor fi adăugate aici. */}
        <p className="app-eyebrow">OAMENII DIN SPATELE PROIECTULUI</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Echipa Universident
        </h1>
        <BackLink href="/" className="mt-8">Înapoi la pagina principală</BackLink>
      </div>
    </main>
  );
}
