import { BackLink } from "@/components/ui/back-link";

export const metadata = { title: "Verificarea mesajelor" };
export default function ModerationInformationPage() {
  return <main id="main-content" className="app-page mx-auto w-full max-w-3xl space-y-5 px-4 py-10 sm:px-6">
    <BackLink href="/cont/mesaje">Înapoi la mesaje</BackLink>
    <h1 className="text-3xl font-semibold">Verificarea mesajelor</h1>
    <p>Înainte de trimitere, textul mesajului este transmis către OpenAI pentru verificarea automată a limbajului abuziv. Nu includem datele contului sau detaliile programării în această cerere. Informațiile pe care le scrii în mesaj fac parte din textul verificat.</p>
    <p>Blocăm mesajele identificate ca jignitoare, amenințătoare, discriminatorii, hărțuitoare sau spam. Nemulțumirile exprimate respectuos și descrierile stomatologice sunt permise.</p>
    <p>Verificarea automată poate greși. Un mesaj blocat nu este transmis destinatarului și rămâne în formular, unde îl poți reformula. Dacă verificarea nu este disponibilă, mesajul nu se trimite; poți încerca din nou mai târziu.</p>
    <p>Mesajele trimise sunt păstrate în istoricul privat al programării. După încheierea programării, conversația apare la „Conversații trecute”. După 7 zile nu se mai pot trimite mesaje, dar istoricul poate fi citit.</p>
    <p>OpenAI nu folosește implicit datele API pentru antrenarea modelelor. Dezactivăm stocarea răspunsurilor, însă pot exista jurnale de monitorizare a abuzurilor, în mod obișnuit până la 30 de zile. <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer" className="underline underline-offset-4">Vezi politica de procesare OpenAI</a>.</p>
  </main>;
}
