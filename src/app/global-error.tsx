"use client";

import Link from "next/link";

type GlobalErrorProps = {
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          background: "#08111f",
          color: "#e8eef7",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "560px",
              border: "1px solid #25344a",
              borderRadius: "16px",
              background: "#101c2d",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 12px", color: "#60a5fa", fontWeight: 700 }}>
              Universident
            </p>
            <h1 style={{ margin: 0, fontSize: "28px" }}>
              A apărut o problemă neașteptată
            </h1>
            <p style={{ margin: "14px 0 24px", color: "#94a3b8", lineHeight: 1.6 }}>
              Încearcă să reîncarci pagina. Dacă problema persistă, revino puțin mai târziu.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={reset}
                style={{ border: 0, borderRadius: "10px", background: "#60a5fa", color: "#07111f", cursor: "pointer", fontWeight: 700, padding: "10px 16px" }}
              >
                Încearcă din nou
              </button>
              <Link
                href="/"
                style={{ border: "1px solid #25344a", borderRadius: "10px", color: "#e8eef7", padding: "9px 16px", textDecoration: "none" }}
              >
                Înapoi acasă
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
