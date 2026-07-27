import { Monitor } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAccountPageSession } from "@/lib/account/account-page-session";

export const metadata: Metadata = {
  title: "Sesiuni active",
  description:
    "Scaffold pentru administrarea sesiunilor active ale contului.",
};

export default async function AccountSessionsPage() {
  await requireAccountPageSession();

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl space-y-8">
        <Link
          href="/cont/securitate"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          ← Înapoi la securitate
        </Link>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Confidențialitate și securitate
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesiuni active
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Aici vei putea consulta dispozitivele conectate și revoca
            sesiunile pe care nu le recunoști.
          </p>
        </div>

        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border bg-background">
              <Monitor className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">
              Lista sesiunilor nu este conectată încă
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Sesiunile active vor fi afișate aici după conectarea
              acestei pagini la sistemul de autentificare.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 h-auto min-h-9 whitespace-normal py-2 text-center"
              disabled
            >
              Deconectează toate celelalte sesiuni
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
