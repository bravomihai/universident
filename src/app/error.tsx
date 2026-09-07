"use client";

import { Home, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorPageProps = {
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main id="main-content" className="app-page flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-6 p-6 text-center sm:p-8">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full border bg-background text-amber-500">
            <TriangleAlert className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Pagina nu a putut fi încărcată
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Problema poate fi temporară. Încearcă din nou sau revino la pagina principală.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" onClick={reset}>
              <RefreshCw aria-hidden="true" />
              Încearcă din nou
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Home aria-hidden="true" />
                Înapoi acasă
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
