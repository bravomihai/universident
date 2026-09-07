import { FileQuestion, Home, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main id="main-content" className="app-page flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-6 p-6 text-center sm:p-8">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full border bg-background text-primary">
            <FileQuestion className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">404</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Pagina nu a fost găsită
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Adresa poate fi greșită sau pagina nu mai este disponibilă.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">
                <Home aria-hidden="true" />
                Înapoi acasă
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studenti">
                <Search aria-hidden="true" />
                Găsește un student
                <span
                  aria-hidden="true"
                  className="inline-block font-semibold leading-none transition-transform group-hover/button:translate-x-0.5"
                >
                  {">"}
                </span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
