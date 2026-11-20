import Link from "@/components/navigation/app-link";
import { privacyNoticePath } from "@/lib/account/policy-confirmations";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Universident</span>
        <address className="flex flex-wrap gap-x-4 gap-y-1 not-italic">
          <a href="https://www.instagram.com/universident.ro/" className="underline underline-offset-4">
            Instagram: @universident.ro
          </a>
          <a href="mailto:contact@universident.ro" className="underline underline-offset-4">
            Email: contact@universident.ro
          </a>
        </address>
        <Link href={privacyNoticePath} className="underline underline-offset-4">
          Informare despre datele personale
        </Link>
        <span>Platformă de conectare, nu furnizor de servicii medicale.</span>
      </div>
    </footer>
  );
}
