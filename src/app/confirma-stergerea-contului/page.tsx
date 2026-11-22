import type { Metadata } from "next";

import { ConfirmAccountDeletion } from "@/components/account/confirm-account-deletion";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Confirmă ștergerea contului",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmAccountDeletionPage() {
  return (
    <main id="main-content" className="app-page flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="card-adjacent">Ștergerea contului</h1>
        <Card><CardContent><ConfirmAccountDeletion /></CardContent></Card>
      </div>
    </main>
  );
}
