import { ArrowRight, MapPin, Search, Stethoscope } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 justify-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="w-full max-w-6xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold text-primary">
              Tratamente stomatologice sub supervizare
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Găsește un student la medicină dentară în orașul tău
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Alege tratamentul și orașul, apoi compară profilurile publice,
              locațiile și profesorii supervizori asociați.
            </p>
            <Button asChild size="lg">
              <Link href="/studenti">
                <Search aria-hidden="true" />
                Găsește un student
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <Card className="bg-muted/15">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-background">
                  <Stethoscope className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">Alege tratamentul</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Căutarea pornește de la procedura de care ai nevoie.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-background">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">Selectează orașul</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vezi numai ofertele active din locațiile relevante.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
