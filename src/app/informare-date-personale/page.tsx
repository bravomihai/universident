import { CalendarDays, MessageSquare, UserRound } from "lucide-react";

import Link from "@/components/navigation/app-link";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { chatRulesPath, privacyNoticeTitle } from "@/lib/account/policy-confirmations";

export const metadata = { title: privacyNoticeTitle };

export default function PrivacyUpdatePage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <article className="w-full max-w-6xl" aria-labelledby="privacy-title">
        <BackLink className="mb-6" />
        <header className="mb-6">
          <h1 id="privacy-title">{privacyNoticeTitle}</h1>
        </header>
        <Card>
          <CardContent className="divide-y">
            <section aria-labelledby="privacy-account" className="space-y-2 pb-5">
              <h2 id="privacy-account" className="flex items-start gap-3 text-lg font-semibold">
                <UserRound className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Cont și autentificare</span>
              </h2>
              <p className="pl-8 text-muted-foreground leading-relaxed">Universident folosește datele contului pentru autentificare și verificarea adresei de email. Data nașterii este cerută înainte de prima programare, pentru verificarea vârstei și calcularea vârstei la data programării.</p>
            </section>

            <section aria-labelledby="privacy-appointments" className="space-y-2 py-5">
              <h2 id="privacy-appointments" className="flex items-start gap-3 text-lg font-semibold">
                <CalendarDays className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Programări și recenzii</span>
              </h2>
              <p className="pl-8 text-muted-foreground leading-relaxed">Studentul cu care ai o programare sau o cerere poate vedea numele tău, vârsta calculată, nota pentru programarea respectivă, descrierea opțională, recenziile publicate despre tine și istoricul programărilor voastre. Profilul pacientului este privat. Dacă publici o recenzie pe profilul unui student, aceasta afișează numele tău și fotografia din profil, dacă ai adăugat una.</p>
            </section>

            <section aria-labelledby="privacy-chat" className="space-y-2 py-5">
              <h2 id="privacy-chat" className="flex items-start gap-3 text-lg font-semibold">
                <MessageSquare className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Chat și istoricul contului</span>
              </h2>
              <div className="space-y-3 pl-8 text-muted-foreground leading-relaxed">
                <p>Chatul este destinat organizării programărilor confirmate. Textul mesajelor este verificat automat prin OpenAI înainte de livrare. Conversațiile sunt păstrate în istoricul privat al programărilor, inclusiv după închiderea trimiterii mesajelor. Aplicația păstrează acest istoric până la o intervenție de ștergere.</p>
                <p>Conturile existente păstrează profilul și istoricul salvat al programărilor, recenziilor și conversațiilor, acolo unde acestea există. Confirmările pentru noile reguli sunt înregistrate separat, cu data, ora și versiunea textului.</p>
                <Link href={chatRulesPath} className="inline-block font-medium text-foreground underline underline-offset-4">Regulile chatului și verificarea mesajelor &gt;</Link>
              </div>
            </section>
            <section aria-labelledby="privacy-deletion" className="space-y-2 pt-5">
              <h2 id="privacy-deletion" className="flex items-start gap-3 text-lg font-semibold">
                <UserRound className="mt-1 size-5 shrink-0 text-destructive" aria-hidden="true" />
                <span>Ștergerea contului</span>
              </h2>
              <div className="space-y-3 pl-8 leading-relaxed text-muted-foreground">
                <p>Poți solicita ștergerea din „Securitatea contului”. După ce introduci parola actuală, primești pe email un link prin care confirmi cererea. Confirmarea închide toate sesiunile și retrage profilul din aplicație.</p>
                <p>Cererile în așteptare se închid, iar programările confirmate care nu au început se anulează. Ceilalți participanți primesc o notificare în cont. Ei păstrează istoricul programărilor cu numele „Cont șters” în locul identității tale. Mesajele, notițele, recenziile dintre participanți și fotografia ta de profil sunt eliminate din aplicație.</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </article>
    </main>
  );
}
