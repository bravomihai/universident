"use client";

import { useState } from "react";

export function MedicalDataReportButton({ endpoint, messageId }: { endpoint: string; messageId: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "reported" | "error">("idle");

  async function report() {
    setStatus("pending");
    try {
      const response = await fetch(endpoint + "/raportari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      setStatus(response.ok ? "reported" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-1 text-right text-[11px] text-muted-foreground">
      {status === "reported" ? <span role="status">Raportare înregistrată</span> : (
        <button
          type="button"
          disabled={status === "pending"}
          onClick={report}
          className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {status === "pending" ? "Se raportează…" : "Raportează date medicale"}
        </button>
      )}
      {status === "error" ? <p role="alert" className="text-destructive">Raportarea nu a putut fi salvată. Încearcă din nou.</p> : null}
    </div>
  );
}
