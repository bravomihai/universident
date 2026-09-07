"use client";

import Link from "next/link";
import "./global-error.css";

type GlobalErrorProps = {
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ro" className="global-error-page">
      <body>
        <main id="main-content">
          <section>
            <p className="global-error-brand">Universident</p>
            <h1>A apărut o problemă neașteptată</h1>
            <p className="global-error-description">
              Încearcă să reîncarci pagina. Dacă problema persistă, revino puțin mai târziu.
            </p>
            <div className="global-error-actions">
              <button type="button" onClick={reset}>Încearcă din nou</button>
              <Link href="/">&lt; Înapoi acasă</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
