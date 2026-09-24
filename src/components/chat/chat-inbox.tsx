"use client";

import Link from "@/components/navigation/app-link";
import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatConversationDto } from "@/lib/chat/types";
import { startChatPolling } from "@/lib/chat/polling";

type InboxData = { conversations: ChatConversationDto[]; nextCursor: string | null };
export function ChatInbox({ initialData, initialPast = false, selectedSlug }: { initialData: InboxData; initialPast?: boolean; selectedSlug?: string }) {
  const [past, setPast] = useState(initialPast);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const loadedPages = useRef(1);
  const fetching = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    const stop = startChatPolling(async (signal) => {
      if (fetching.current) return;
      fetching.current = true;
      try {
        const next: InboxData = { conversations: [], nextCursor: null };
        for (let page = 0; page < loadedPages.current; page++) {
          const cursor = next.nextCursor ? `&cursor=${encodeURIComponent(next.nextCursor)}` : "";
          const response = await fetch(`/api/mesaje?trecute=${past ? "1" : "0"}${cursor}`, { cache: "no-store", signal });
          if (!response.ok) throw new Error();
          const part: InboxData = await response.json();
          next.conversations.push(...part.conversations.filter((c) => !next.conversations.some((old) => old.slug === c.slug)));
          next.nextCursor = part.nextCursor;
          if (!part.nextCursor) break;
        }
        if (!signal.aborted && generation.current === current) {
          setData(next);
          setError("");
        }
      } catch { if (!signal.aborted) setError("Lista nu se poate actualiza. Verifică conexiunea."); }
      finally { if (generation.current === current) fetching.current = false; }
    });
    return () => { stop(); fetching.current = false; };
  }, [past]);

  async function loadMore() {
    if (!data.nextCursor || loading || fetching.current) return;
    const current = generation.current;
    fetching.current = true;
    setLoading(true);
    try {
      const response = await fetch(`/api/mesaje?trecute=${past ? "1" : "0"}&cursor=${encodeURIComponent(data.nextCursor)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const next: InboxData = await response.json();
      if (current === generation.current) {
        loadedPages.current++;
        setData((old) => ({ conversations: [...old.conversations, ...next.conversations.filter((c) => !old.conversations.some((o) => o.slug === c.slug))], nextCursor: next.nextCursor }));
      }
    } catch { if (current === generation.current) setError("Lista nu se poate încărca. Încearcă din nou."); }
    finally { if (current === generation.current) fetching.current = false; setLoading(false); }
  }
  return <section aria-label="Conversații" className="flex min-h-0 flex-col">
    <div className="grid grid-cols-2 gap-1 border-b p-3" role="group" aria-label="Tipul conversațiilor">
      {[false, true].map((value) => <Button key={String(value)} size="sm" variant={past === value ? "secondary" : "ghost"} aria-pressed={past === value} className="h-auto min-h-9 whitespace-normal px-2" onClick={() => { if (value !== past) { loadedPages.current = 1; setData({ conversations: [], nextCursor: null }); setPast(value); } }}>{value ? "Conversații trecute" : "Conversații active"}</Button>)}
    </div>
    {error ? <p role="status" className="p-3 text-sm text-destructive">{error}</p> : null}
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {data.conversations.length ? <ul className="space-y-1">{data.conversations.map((c) => <li key={c.slug}>
        <Link href={`/cont/mesaje/${encodeURIComponent(c.slug)}`} navigation={selectedSlug ? "replace" : "forward"} prefetch={false} aria-current={selectedSlug === c.slug ? "page" : undefined} className={cn("block rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedSlug === c.slug && "border-border bg-muted/60")}>
          <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words font-semibold">{c.counterpartName}</p>{c.unreadCount ? <span className="shrink-0 rounded-full bg-primary px-2 text-xs leading-5 text-primary-foreground" aria-label={c.unreadCount === 1 ? "Un mesaj necitit" : `${c.unreadCount} mesaje necitite`}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span> : null}</div>
          <p className="mt-1 text-xs text-muted-foreground">{c.treatment} · {new Date(c.startsAt).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "short" })}</p>
          <p className={cn("mt-2 line-clamp-2 break-words text-sm", c.unreadCount ? "font-medium" : "text-muted-foreground")}>{c.lastMessage ?? "Conversația este disponibilă. Poți trimite primul mesaj."}</p>
          {c.past ? <p className="mt-2 text-xs text-muted-foreground">{c.canSend ? "Mai poți trimite mesaje" : "Doar citire"}</p> : null}
        </Link>
      </li>)}</ul> : <div className="px-4 py-10 text-center text-sm text-muted-foreground"><MessageCircle className="mx-auto mb-3 size-8" aria-hidden="true" /><p>{past ? "Nu ai conversații trecute." : "Conversațiile apar după acceptarea unei programări."}</p></div>}
      {data.nextCursor ? <Button variant="outline" className="mt-3 w-full" disabled={loading} onClick={loadMore}>{loading ? "Se încarcă…" : "Mai multe conversații"}</Button> : null}
    </div>
  </section>;
}
