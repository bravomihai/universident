import type { Metadata } from "next";
import Image from "next/image";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./team.module.css";

export const metadata: Metadata = {
  title: "Echipa",
  description:
    "Cunoaște-i pe Irina Nemeș și Nemeș Mihail și descoperă povestea din spatele UniversiDent.",
  robots: { index: false, follow: true },
};

export default function TeamPage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-6xl">
        <p className="app-eyebrow">OAMENII DIN SPATELE PROIECTULUI</p>
        <Card className="sm:py-8">
          <CardContent className="sm:px-8">
            <article className={styles.story} aria-labelledby="team-title">
              <Image
                src="/team/fondatori-universident.png"
                alt="Irina Nemeș și Nemeș Mihail, fondatorii UniversiDent"
                width={1366}
                height={2048}
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 40vw, 288px"
                preload
                className={styles.photo}
              />

              <header className={styles.headingGroup}>
                <h1 id="team-title">Cine este în spatele UniversiDent?</h1>
                <p>
                  <strong>Irina Nemeș</strong>, studentă la Medicină Dentară, și{" "}
                  <strong>Nemeș Mihail</strong>, student la UTCN.
                </p>
              </header>
              <p>
                UniversiDent a pornit dintr-o combinație simplă: experiența directă
                din medicina dentară și perspectiva tehnică asupra modului în care
                tehnologia poate face lucrurile mai ușoare.
              </p>

              <div className={`${styles.headingGroup} ${styles.sectionStart}`}>
                <h2>De unde a pornit ideea</h2>
                <p>
                  În facultate, am observat cât de fragmentat poate fi procesul prin
                  care studenții își găsesc pacienți pentru practica clinică. Am
                  început să ne întrebăm dacă nu există o modalitate mai simplă de
                  a face această conexiune.
                </p>
              </div>
              <p>
                Așa a apărut ideea UniversiDent: o platformă care să aducă într-un
                singur loc studenții la Medicină Dentară și pacienții care caută
                opțiuni de tratament accesibile.
              </p>

              <div className={`${styles.headingGroup} ${styles.sectionStart}`}>
                <h2>Două perspective. O singură direcție.</h2>
                <p>
                  Medicina dentară ne-a arătat problema din interior. Tehnologia
                  ne-a oferit instrumentele prin care puteam construi o soluție.
                </p>
              </div>
              <p>
                Am pornit de la primele idei și schițe și am ajuns, pas cu pas, la
                platforma pe care o dezvoltăm astăzi. UniversiDent este construit
                la intersecția dintre educație
                medicală, tehnologie și nevoile reale ale oamenilor.
              </p>
              <p>
                Nu încercăm să schimbăm modul în care se învață medicina dentară.
                Încercăm să facem un anumit proces din jurul ei mai simplu, mai
                organizat și mai ușor de accesat.
              </p>
              <p>De aici începe UniversiDent.</p>
              <p className={styles.tagline}>Unde învățarea devine grijă.</p>
            </article>
          </CardContent>
        </Card>
        <BackLink href="/" className="mt-8">Înapoi la pagina principală</BackLink>
      </div>
    </main>
  );
}
