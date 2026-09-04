import { KeyRound, Mail } from "lucide-react";
import Link from "next/link";

import { ChangeEmailForm } from "@/components/account/change-email-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireAccountPageSession } from "@/lib/account/account-page-session";

type AccountSecurityPageProps = {
  searchParams: Promise<{
    emailSchimbat?: string | string[];
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountSecurityPage({
  searchParams,
}: AccountSecurityPageProps) {
  const [session, params] = await Promise.all([
    requireAccountPageSession(),
    searchParams,
  ]);
  const emailWasChanged = firstValue(params.emailSchimbat) === "1";
  const emailChangeError = firstValue(params.error);

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl space-y-6">
        <Link
          href="/cont"
          className="inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {"<"} Înapoi la cont
        </Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Securitatea contului
          </h1>
          <p className="text-muted-foreground">
            Gestionează adresa de email și parola contului tău.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                  <Mail className="size-4" aria-hidden="true" />
                </span>

                <div className="space-y-1">
                  <h2 className="font-semibold">
                    Schimbă adresa de email
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Noua adresă va deveni activă după ce o confirmi.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Adresa actuală
                </p>
                <p className="break-all text-sm font-medium">
                  {session.user.email}
                </p>
              </div>

              {emailWasChanged && !emailChangeError ? (
                <p
                  role="status"
                  className="text-sm text-muted-foreground"
                >
                  Adresa de email a fost schimbată.
                </p>
              ) : null}

              {emailChangeError ? (
                <p role="alert" className="text-sm text-destructive">
                  Linkul de verificare nu este valid sau a expirat.
                </p>
              ) : null}

              <ChangeEmailForm currentEmail={session.user.email} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30">
                  <KeyRound className="size-4" aria-hidden="true" />
                </span>

                <div className="space-y-1">
                  <h2 className="font-semibold">Schimbă parola</h2>
                  <p className="text-sm text-muted-foreground">
                    Vei avea nevoie de parola actuală pentru a seta una nouă.
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                După schimbare, celelalte sesiuni vor fi deconectate pentru
                protejarea contului.
              </p>

              <ChangePasswordForm />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
