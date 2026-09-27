import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { DentalToothIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { CodeXml, Compass, HeartHandshake, Lightbulb, Users } from "lucide-react";

import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./team.module.css";

export const metadata: Metadata = {
  title: "Echipa",
  description:
    "Cunoaște-i pe Irina Nemeș și Nemeș Mihail și descoperă povestea din spatele UniversiDent.",
  robots: { index: false, follow: true },
};

function ToothIcon(props: Omit<ComponentProps<typeof HugeiconsIcon>, "icon">) {
  return <HugeiconsIcon icon={DentalToothIcon} {...props} />;
}

const teamMembers = [
  {
    name: "Irina Nemeș",
    studies: "Studentă la UMF Cluj",
    image: "/team/irina-nemes.jpg",
    icon: ToothIcon,
  },
  {
    name: "Nemeș Mihail",
    studies: "Student la UTCN",
    image: "/team/mihail-nemes.jpg",
    icon: CodeXml,
  },
];

const storySections = [
  {
    id: "inceput",
    title: "Cum a început UniversiDent",
    icon: Users,
    paragraphs: [
      "UniversiDent a pornit dintr-o combinație simplă: experiența directă din medicina dentară și perspectiva tehnică asupra modului în care tehnologia poate face lucrurile mai ușoare.",
    ],
  },
  {
    id: "ideea",
    title: "De unde a pornit ideea",
    icon: Lightbulb,
    paragraphs: [
      "În facultate, am observat cât de fragmentat poate fi procesul prin care studenții își găsesc pacienți pentru practica clinică. Am început să ne întrebăm dacă nu există o modalitate mai simplă de a face această conexiune.",
      "Așa a apărut ideea UniversiDent: o platformă care să aducă într-un singur loc studenții la Medicină Dentară și pacienții care caută opțiuni de tratament accesibile.",
    ],
  },
  {
    id: "perspective",
    title: "Două perspective. O singură direcție.",
    icon: Compass,
    paragraphs: [
      "Medicina dentară ne-a arătat problema din interior. Tehnologia ne-a oferit instrumentele prin care puteam construi o soluție.",
      "Am pornit de la primele idei și schițe și am ajuns, pas cu pas, la platforma pe care o dezvoltăm astăzi. UniversiDent este construit la intersecția dintre educație medicală, tehnologie și nevoile reale ale oamenilor.",
    ],
  },
  {
    id: "misiune",
    title: "Ce ne propunem",
    icon: HeartHandshake,
    paragraphs: [
      "Nu încercăm să schimbăm modul în care se învață medicina dentară. Încercăm să facem un anumit proces din jurul ei mai simplu, mai organizat și mai ușor de accesat.",
      "De aici începe UniversiDent.",
    ],
    tagline: "Unde învățarea devine grijă.",
  },
];

export default function TeamPage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <article className="w-full max-w-6xl" aria-labelledby="team-title">
        <header className="mb-8 space-y-4 sm:mb-10">
          <p className="app-eyebrow">OAMENII DIN SPATELE PROIECTULUI</p>
          <h1 id="team-title">Cine este în spatele UniversiDent?</h1>
          <p className="max-w-3xl text-muted-foreground leading-relaxed">
            <strong className="font-semibold text-foreground">Irina Nemeș</strong>, studentă la UMF Cluj, și{" "}
            <strong className="font-semibold text-foreground">Nemeș Mihail</strong>, student la UTCN.
          </p>
        </header>

        <div className={styles.teamGrid}>
          {teamMembers.map((member) => {
            const Icon = member.icon;
            return (
              <Card key={member.name} className="min-w-0 gap-0 pt-0 pb-4 sm:pb-6">
                <figure>
                  <div className={styles.portraitFrame}>
                    <Image
                      src={member.image}
                      alt={`Portret ${member.name}`}
                      width={1066}
                      height={1600}
                      sizes="(max-width: 639px) calc((100vw - 44px) / 2), (max-width: 1199px) calc((100vw - 72px) / 2), 564px"
                      className={styles.portrait}
                    />
                  </div>
                  <figcaption className="flex flex-col items-start gap-2 px-3 pt-4 sm:flex-row sm:gap-3 sm:px-6 sm:pt-6">
                    <Icon className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                    <div className="min-w-0 space-y-2">
                      <h2 className="text-base font-semibold sm:text-lg">{member.name}</h2>
                      <p className="text-muted-foreground leading-relaxed">{member.studies}</p>
                    </div>
                  </figcaption>
                </figure>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent>
            <div className="divide-y">
              {storySections.map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.id} aria-labelledby={`team-${section.id}`} className="space-y-2 py-5 first:pt-0 last:pb-0">
                    <h2 id={`team-${section.id}`} className="flex items-start gap-3 text-lg font-semibold">
                      <Icon className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                      <span className="min-w-0">{section.title}</span>
                    </h2>
                    <div className="max-w-3xl space-y-3 pl-8 text-muted-foreground leading-relaxed">
                      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      {section.tagline && <p className="font-semibold text-primary">{section.tagline}</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <BackLink className="mt-8" />
      </article>
    </main>
  );
}
