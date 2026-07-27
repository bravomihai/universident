import {
  AtSign,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountScaffoldStatus } from "@/components/account/account-scaffold";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { accountRoleLabels } from "@/lib/account/account-role";

export const metadata: Metadata = {
  title: "Informații despre cont",
  description:
    "Consultă datele generale asociate contului Universident.",
};

export default async function AccountInformationPage() {
  const session = await requireAccountPageSession();
  const roleLabel = accountRoleLabels[session.user.role];

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl space-y-8">
        <Link
          href="/cont"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          ← Înapoi la cont
        </Link>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Contul meu
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Informații despre cont
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Consultă numele, emailul principal și rolul asociat
            contului. Editarea va fi conectată într-un checkpoint
            ulterior.
          </p>
        </div>

        <Card>
          <CardHeader>
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>
              <h2>Date personale</h2>
            </CardTitle>
            <CardDescription>
              Datele disponibile în sesiunea autentificată curentă.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-sm text-muted-foreground">
                  Nume
                </dt>
                <dd className="font-medium">{session.user.name}</dd>
              </div>

              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">
                  Email
                </dt>
                <dd className="break-all font-medium">
                  {session.user.email}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col items-start gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Disponibil într-un checkpoint următor.
              </p>
              <Button type="button" variant="outline" disabled>
                Editează datele
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <CardTitle>
                <h2>Email principal</h2>
              </CardTitle>
              <CardDescription>
                Adresa folosită în prezent de cont.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="break-all font-medium">
                  {session.user.email}
                </p>
                <AccountScaffoldStatus>
                  Starea verificării va fi conectată ulterior
                </AccountScaffoldStatus>
              </div>

              <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Verifică emailul
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Schimbă emailul
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
                <ShieldCheck
                  className="size-5"
                  aria-hidden="true"
                />
              </span>
              <CardTitle>
                <h2>Rolul contului</h2>
              </CardTitle>
              <CardDescription>
                Tipul de acces atribuit contului Universident.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                <AtSign
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-medium">{roleLabel}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Rolul contului nu poate fi modificat din această
                pagină.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
