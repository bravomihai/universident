import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Echipa",
  robots: { index: false, follow: true },
};

export default function TeamPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="w-full max-w-6xl">
        {/* Fotografiile și prezentările creatorilor vor fi adăugate aici. */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Echipa Universident
        </h1>
      </div>
    </main>
  );
}
