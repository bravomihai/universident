import {
  Bell,
  ChevronRight,
  Database,
  Download,
  Fingerprint,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  AccountScaffoldRow,
  AccountScaffoldStatus,
} from "@/components/account/account-scaffold";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAccountPageSession } from "@/lib/account/account-page-session";

export const metadata: Metadata = {
  title: "Confidențialitate și securitate",
  description:
    "Consultă structura viitoarelor opțiuni de securitate și confidențialitate.",
};

const plannedProtectionItems = [
  "Email principal verificat",
  "Parolă configurată",
  "Autentificare în doi pași",
  "Email de recuperare",
  "Coduri de recuperare",
  "Passkeys",
];

export default async function AccountSecurityPage() {
  await requireAccountPageSession();

  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl space-y-8">
        <Link
          href="/cont"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          ← Înapoi la cont
        </Link>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-card">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              Confidențialitate și securitate
            </h1>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Această pagină prezintă structura viitoarelor setări.
            Nicio metodă de autentificare, recuperare sau administrare
            a datelor nu este conectată încă.
          </p>
        </div>

        <Card>
          <CardHeader>
            <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>
              <h2>Protecția contului</h2>
            </CardTitle>
            <CardDescription>
              Configurarea securității va fi disponibilă în
              checkpointurile următoare.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {plannedProtectionItems.map((item) => (
                <li
                  key={item}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-muted/15 px-4 py-3"
                >
                  <span className="text-sm font-medium">{item}</span>
                  <AccountScaffoldStatus>
                    În curând
                  </AccountScaffoldStatus>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Metode de autentificare</h2>
            </CardTitle>
            <CardDescription>
              Opțiunile sunt exclusiv vizuale și nu inițiază
              autentificări sau configurări externe.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AccountScaffoldRow
              icon={
                <LockKeyhole
                  className="size-4"
                  aria-hidden="true"
                />
              }
              title="Email și parolă"
              description="Autentificare clasică folosind adresa de email."
              actionLabel="Gestionează"
            />
            <AccountScaffoldRow
              icon={
                <Globe2 className="size-4" aria-hidden="true" />
              }
              title="Google"
              description="Conectează un cont Google ca metodă suplimentară de autentificare."
              actionLabel="Conectează"
            />
            <AccountScaffoldRow
              icon={
                <Smartphone
                  className="size-4"
                  aria-hidden="true"
                />
              }
              title="Apple"
              description="Conectează un cont Apple ca metodă suplimentară de autentificare."
              actionLabel="Conectează"
            />
            <AccountScaffoldRow
              icon={
                <Fingerprint
                  className="size-4"
                  aria-hidden="true"
                />
              }
              title="Passkeys"
              description="Autentificare folosind dispozitivul, amprenta, Face ID sau PIN-ul sistemului."
              actionLabel="Configurează"
            />
            <AccountScaffoldRow
              icon={
                <KeyRound className="size-4" aria-hidden="true" />
              }
              title="Aplicație Authenticator"
              description="Coduri temporare generate de o aplicație Authenticator."
              actionLabel="Configurează"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Recuperarea contului</h2>
              </CardTitle>
              <CardDescription>
                Opțiuni planificate pentru redobândirea accesului la
                cont.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <AccountScaffoldRow
                icon={
                  <Mail className="size-4" aria-hidden="true" />
                }
                title="Email secundar"
                description="O adresă verificată care poate ajuta la recuperarea contului dacă pierzi accesul la emailul principal."
                actionLabel="Adaugă email secundar"
              />
              <AccountScaffoldRow
                icon={
                  <KeyRound
                    className="size-4"
                    aria-hidden="true"
                  />
                }
                title="Coduri de recuperare"
                description="Coduri de unică folosință păstrate offline pentru acces în caz de urgență."
                actionLabel="Generează coduri"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Sesiuni active</h2>
              </CardTitle>
              <CardDescription>
                Vezi unde este conectat contul și revocă accesul
                atunci când nu recunoști o sesiune.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex gap-3 rounded-xl border bg-muted/15 px-4 py-3">
                <Monitor
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  Lista sesiunilor va fi conectată ulterior la
                  sistemul de autentificare.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/cont/securitate/sesiuni"
                  className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 transition hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Vezi sesiunile
                  <ChevronRight
                    className="size-4"
                    aria-hidden="true"
                  />
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-8 whitespace-normal py-2 text-center"
                  disabled
                >
                  Deconectează toate celelalte sesiuni
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <span className="inline-flex size-10 items-center justify-center rounded-full border bg-muted/30">
                <Smartphone
                  className="size-5"
                  aria-hidden="true"
                />
              </span>
              <CardTitle>
                <h2>Autentificări noi</h2>
              </CardTitle>
              <CardDescription>
                Verificări suplimentare pentru contexte
                nerecunoscute.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Pentru autentificările de pe browsere sau dispozitive
                nerecunoscute, Universident va putea solicita o
                verificare suplimentară.
              </p>
              <p>
                Metodele planificate sunt passkey, aplicația
                Authenticator și codul de recuperare.
              </p>
              <p className="flex gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Locația aproximativă va fi doar unul dintre semnalele
                analizate, nu singurul criteriu.
              </p>
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
                <h2>Reconfirmarea identității</h2>
              </CardTitle>
              <CardDescription>
                Protecție suplimentară pentru modificări sensibile.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Anumite modificări sensibile vor solicita
                reconfirmarea identității, chiar dacă utilizatorul
                este deja autentificat.
              </p>
              <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <li>• schimbarea emailului;</li>
                <li>• schimbarea parolei;</li>
                <li>• eliminarea unei metode de autentificare;</li>
                <li>• regenerarea codurilor de recuperare;</li>
                <li>• revocarea sesiunilor;</li>
                <li>• ștergerea contului.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Confidențialitate și date</h2>
            </CardTitle>
            <CardDescription>
              Instrumente planificate pentru alerte, export și
              administrarea datelor contului.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AccountScaffoldRow
              icon={
                <Bell className="size-4" aria-hidden="true" />
              }
              title="Notificări de securitate"
              description="Primește alerte pentru autentificări noi și modificări sensibile."
              actionLabel="Gestionează notificările"
            />
            <AccountScaffoldRow
              icon={
                <Download className="size-4" aria-hidden="true" />
              }
              title="Descărcarea datelor"
              description="Solicită o copie a datelor asociate contului."
              actionLabel="Solicită datele"
            />
            <AccountScaffoldRow
              icon={
                <Database className="size-4" aria-hidden="true" />
              }
              title="Păstrarea datelor"
              description="Află cum sunt păstrate și protejate datele contului."
              actionLabel="Vezi informațiile"
            />

            <AccountScaffoldRow
              icon={
                <Trash2 className="size-4" aria-hidden="true" />
              }
              title="Ștergerea contului"
              description="Inițiază procesul de ștergere a contului și a datelor asociate. Funcționalitatea nu este încă disponibilă."
              actionLabel="Șterge contul"
              statusLabel="Indisponibil"
              isDangerous
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
