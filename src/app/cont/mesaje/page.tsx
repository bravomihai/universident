import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { ChatInbox } from "@/components/chat/chat-inbox";
import { BackLink } from "@/components/ui/back-link";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { listChatConversations } from "@/lib/chat/service";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Mesaje", robots: { index: false, follow: false } };
export default async function MessagesPage() {
  const session = await requireAccountPageSession("/cont/mesaje");
  if (!["PATIENT", "STUDENT"].includes(session.user.role)) notFound();
  const data = await listChatConversations(session.user);
  return <main id="main-content" className="app-page chat-page flex justify-center px-4 py-2 sm:px-6 sm:py-4"><div className="flex min-h-0 w-full max-w-6xl flex-col gap-3">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-semibold">Mesaje</h1><BackLink /></div>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card md:grid-cols-[20rem_minmax(0,1fr)]">
      <ChatInbox initialData={data} />
      <div className="hidden flex-col items-center justify-center border-l p-8 text-center text-muted-foreground md:flex"><MessageCircle className="mb-4 size-10" aria-hidden="true" /><p>Selectează o conversație pentru a vedea mesajele.</p><p className="mt-2 max-w-sm text-sm">Poți discuta cu cealaltă persoană după acceptarea programării.</p></div>
    </div>
  </div></main>;
}
