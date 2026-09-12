import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatInbox } from "@/components/chat/chat-inbox";
import { ChatPanel } from "@/components/chat/chat-panel";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { getChatPage, listChatConversations } from "@/lib/chat/service";
import { ChatError } from "@/lib/chat/errors";

export const metadata: Metadata = { title: "Conversație", robots: { index: false, follow: false } };
export default async function ConversationPage({ params }: { params: Promise<{ conversationSlug: string }> }) {
  const { conversationSlug } = await params;
  const session = await requireAccountPageSession(`/cont/mesaje/${encodeURIComponent(conversationSlug)}`);
  let data;
  try { data = await getChatPage(conversationSlug, session.user); }
  catch (error) { if (error instanceof ChatError && error.status === 404) notFound(); throw error; }
  if (conversationSlug !== data.conversation.slug) redirect(`/cont/mesaje/${data.conversation.slug}`);
  const inbox = await listChatConversations(session.user, data.conversation.past);
  return <main id="main-content" className="app-page chat-page flex justify-center px-4 py-2 sm:px-6 sm:py-4"><div className="flex min-h-0 w-full max-w-6xl flex-col">
    <h1 className="sr-only">Conversație cu {data.conversation.counterpartName}</h1>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card md:grid-cols-[19rem_minmax(0,1fr)]">
      <div className="hidden min-h-0 overflow-hidden border-r md:grid"><ChatInbox initialData={inbox} initialPast={data.conversation.past} selectedSlug={conversationSlug} /></div>
      <ChatPanel key={conversationSlug} initialData={data} />
    </div>
  </div></main>;
}
