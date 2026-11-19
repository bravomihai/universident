import Link from "@/components/navigation/app-link";
import { privacyNoticePath } from "@/lib/account/policy-confirmations";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} Universident</span><Link href={privacyNoticePath} className="underline underline-offset-4">Informare despre datele personale</Link><span>Platformă de conectare, nu furnizor de servicii medicale.</span></div>
    </footer>
  );
}
