import { Flag, GraduationCap, ShieldCheck, UserRound } from "lucide-react";

import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { policyConfirmations } from "@/lib/account/policy-confirmations";

const title = "Regulile chatului și verificarea mesajelor";

export const metadata = { title };

export default function ModerationInformationPage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <article className="w-full max-w-6xl" aria-labelledby="chat-rules-title">
        <BackLink className="mb-6" />
        <header className="mb-6">
          <h1 id="chat-rules-title">{title}</h1>
        </header>
        <Card>
          <CardContent className="divide-y">
            <section aria-labelledby="chat-rules-patients" className="space-y-2 pb-5">
              <h2 id="chat-rules-patients" className="flex items-start gap-3 text-lg font-semibold">
                <UserRound className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Pentru pacienți</span>
              </h2>
              <p className="pl-8 text-muted-foreground leading-relaxed">{policyConfirmations.patientChat.publicText}</p>
            </section>

            <section aria-labelledby="chat-rules-students" className="space-y-2 py-5">
              <h2 id="chat-rules-students" className="flex items-start gap-3 text-lg font-semibold">
                <GraduationCap className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Pentru studenți</span>
              </h2>
              <p className="pl-8 text-muted-foreground leading-relaxed">{policyConfirmations.studentChat.publicText}</p>
            </section>

            <section aria-labelledby="chat-rules-reporting" className="space-y-2 py-5">
              <h2 id="chat-rules-reporting" className="flex items-start gap-3 text-lg font-semibold">
                <Flag className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Dacă au fost trimise date medicale din greșeală</span>
              </h2>
              <p className="pl-8 text-muted-foreground leading-relaxed">Participanții pot folosi butonul „Raportează date medicale” de sub mesajul respectiv. Raportarea indică mesajul existent, fără a necesita copierea textului sau trimiterea unor explicații medicale suplimentare.</p>
            </section>

            <section aria-labelledby="chat-rules-moderation" className="space-y-2 pt-5">
              <h2 id="chat-rules-moderation" className="flex items-start gap-3 text-lg font-semibold">
                <ShieldCheck className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                <span>Verificarea automată a mesajelor</span>
              </h2>
              <div className="space-y-3 pl-8 text-muted-foreground leading-relaxed">
                <p>Universident transmite textul către OpenAI pentru verificarea automată a limbajului abuziv înainte de livrarea mesajului. Cererea include informațiile scrise de autor în mesaj. Datele contului și detaliile programării nu sunt adăugate la cerere.</p>
                <p>Universident blochează mesajele identificate ca jignitoare, amenințătoare, discriminatorii, hărțuitoare sau spam. Verificarea încearcă să detecteze și detaliile medicale personale sau solicitările de a le transmite. Mesajele despre organizarea programării și nemulțumirile exprimate respectuos sunt permise.</p>
                <p>Verificarea automată poate greși. Un mesaj blocat rămâne în formular, unde autorul îl poate reformula. Destinatarul nu primește mesajul blocat. Dacă verificarea este indisponibilă, trimiterea mesajului este oprită, iar autorul poate încerca din nou mai târziu.</p>
                <p>Mesajele trimise sunt păstrate în istoricul privat al programării. După încheierea programării, conversația apare la „Conversații trecute”. După 7 zile nu se mai pot trimite mesaje, dar istoricul poate fi citit.</p>
                <p>OpenAI nu folosește implicit datele pentru antrenarea modelelor. Universident dezactivează stocarea răspunsurilor, însă pot exista jurnale de monitorizare a abuzurilor, în mod obișnuit până la 30 de zile.</p>
                <a
                  href="https://developers.openai.com/api/docs/guides/your-data"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-medium text-foreground underline underline-offset-4"
                >
                  Politica OpenAI privind prelucrarea datelor &gt;
                </a>
              </div>
            </section>
          </CardContent>
        </Card>
      </article>
    </main>
  );
}
