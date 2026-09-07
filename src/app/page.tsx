import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ClipboardCheck, GraduationCap, Search, ShieldCheck, UserRound } from "lucide-react";
import { ToothHero } from "@/components/home/tooth-hero";
import { HowItWorksCard } from "@/components/home/how-it-works-card";
import { StudentJoinLink } from "@/components/home/student-join-link";
import { RecentStudents, RecentStudentsLoading } from "@/components/home/recent-students";
import { Button } from "@/components/ui/button";
import { NavigationLink } from "@/components/ui/navigation-link";
import "@/components/home/home.css";

export default function Home() {
  return (
    <main id="main-content" className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-inner">
          <h1 id="home-title">
            Practică pentru studenți.
            <span>Îngrijire gratuită pentru pacienți.</span>
          </h1>
          <ToothHero />
          <div className="home-hero-details">
            <p className="home-hero-note">
              <ShieldCheck aria-hidden="true" />
              <span>Tratamente realizate sub supervizare.</span>
            </p>
            <p className="home-hero-description">
              Găsește un student la medicină dentară în orașul tău, alege tratamentul de care ai nevoie și fă-ți o programare.
            </p>
            <div className="home-hero-actions">
              <Button asChild size="lg" className="home-primary-action">
                <Link href="/studenti">Găsește un student <span aria-hidden="true">&gt;</span></Link>
              </Button>
              <NavigationLink href="#cum-functioneaza">Cum funcționează</NavigationLink>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-recent" aria-labelledby="recent-title">
        <div className="home-section-heading home-heading-row">
          <div>
            <h2 id="recent-title">Profiluri actualizate recent</h2>
          </div>
          <NavigationLink className="home-browse-action" href="/studenti">Vezi toți studenții</NavigationLink>
        </div>
        <Suspense fallback={<RecentStudentsLoading />}><RecentStudents /></Suspense>
      </section>

      <section className="home-section home-how" aria-labelledby="how-title">
        <HowItWorksCard>
          <div className="home-how-intro">
            <h2 id="how-title">Cum te programezi</h2>
          </div>
          <ol className="home-booking-steps" role="list">
            <li>
              <span className="home-booking-step-icon"><Search aria-hidden="true" /></span>
              <h3>Alege tratamentul și orașul</h3>
              <p>
                Caută serviciul de care ai nevoie, acolo unde îți este la îndemână.
              </p>
            </li>
            <li>
              <span className="home-booking-step-icon"><UserRound aria-hidden="true" /></span>
              <h3>Descoperă profilurile</h3>
              <p>
                Cunoaște studentul, consultă recenziile și vezi cine supervizează tratamentul.
              </p>
            </li>
            <li>
              <span className="home-booking-step-icon"><CalendarDays aria-hidden="true" /></span>
              <h3>Alege un interval disponibil</h3>
              <p>
                Trimite cererea pentru programare și urmărește confirmarea din contul tău.
              </p>
            </li>
          </ol>
        </HowItWorksCard>
      </section>

      <section className="home-section home-community" aria-labelledby="community-title">
        <div className="home-community-panel">
          <div>
            <p className="home-kicker"><GraduationCap aria-hidden="true" />PENTRU VIITORII MEDICI</p>
            <h2 id="community-title">Tu înveți.<br />Cineva zâmbește.</h2>
            <p>Fă loc practicii în programul tău. Prezintă-te pacienților, adaugă tratamentele și organizează-ți disponibilitatea într-un singur loc.</p>
            <StudentJoinLink />
          </div>
          <ul className="home-community-list">
            <li><span className="home-community-icon"><UserRound aria-hidden="true" /></span><div><h3>Un profil care te reprezintă</h3><p>Universitatea, experiența și tratamentele tale, ușor de descoperit.</p></div></li>
            <li><span className="home-community-icon"><CalendarDays aria-hidden="true" /></span><div><h3>Un calendar, mai multă claritate</h3><p>Alegi când și unde poți primi pacienți.</p></div></li>
            <li><span className="home-community-icon"><ClipboardCheck aria-hidden="true" /></span><div><h3>Fiecare cerere, la îndemână</h3><p>Gestionezi programările și confirmările din contul tău.</p></div></li>
          </ul>
        </div>
      </section>

    </main>
  );
}
