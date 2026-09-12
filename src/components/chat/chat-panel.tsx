"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAT_MAX_LENGTH } from "@/lib/chat/policy";
import { CHAT_CHANGED_EVENT, startChatPolling } from "@/lib/chat/polling";
import type { ChatMessageDto, ChatPageDto } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

function mergeMessages(existing: ChatMessageDto[], incoming: ChatMessageDto[]) {
  const map = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = map.get(message.id);
    map.set(message.id, { ...message, readAt: message.readAt ?? previous?.readAt ?? null });
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function ChatPanel({ initialData }: { initialData: ChatPageDto }) {
  const [data, setData] = useState(initialData);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const keepBottom = useRef(true);
  const requestId = useRef<{ text: string; id: string } | null>(null);
  const reading = useRef(false);
  const seenMessageIds = useRef(new Set(initialData.messages.map((message) => message.id)));
  const slug = initialData.conversation.slug;
  const endpoint = `/api/mesaje/${encodeURIComponent(slug)}`;

  useEffect(() => {
    return startChatPolling(async (signal) => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal });
        if (!response.ok) throw new Error();
        const next: ChatPageDto = await response.json();
        if (signal.aborted) return;
        const newIncoming = next.messages.filter((message) => !message.own && !seenMessageIds.current.has(message.id));
        next.messages.forEach((message) => seenMessageIds.current.add(message.id));
        if (newIncoming.length && !keepBottom.current) setUnseenCount((count) => count + newIncoming.length);
        setData((old) => {
          const known = new Set(old.messages.map((message) => message.id));
          // After a long interruption, start from a complete page so no gap is silently hidden.
          const gap = next.olderCursor && !next.messages.some((message) => known.has(message.id));
          return gap
            ? next
            : { ...next, messages: mergeMessages(old.messages, next.messages), olderCursor: old.olderCursor };
        });
        setConnectionError(false);
      } catch { if (!signal.aborted) setConnectionError(true); }
    });
  }, [endpoint]);

  useLayoutEffect(() => {
    const area = scroll.current;
    if (area && keepBottom.current) area.scrollTop = area.scrollHeight;
  }, [data.messages]);

  useEffect(() => {
    const area = scroll.current;
    if (!area) return;
    const controller = new AbortController();
    async function markVisible() {
      if (!area || reading.current || document.visibilityState !== "visible" || !document.hasFocus()) return;
      const bounds = area.getBoundingClientRect();
      const ids = [...area.querySelectorAll<HTMLElement>("[data-unread-message]")].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > Math.max(bounds.top, 0) && rect.top < Math.min(bounds.bottom, window.innerHeight);
      }).map((element) => element.dataset.unreadMessage!).slice(0, 100);
      if (!ids.length) return;
      reading.current = true;
      try {
        const response = await fetch(`${endpoint}/citite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }), signal: controller.signal });
        if (response.ok && !controller.signal.aborted) {
          const read = new Set(ids);
          setData((old) => ({ ...old, messages: old.messages.map((m) => read.has(m.id) ? { ...m, readAt: new Date().toISOString() } : m) }));
          window.dispatchEvent(new Event(CHAT_CHANGED_EVENT));
        }
      } catch { /* A later view retries the read receipt. */ }
      finally { reading.current = false; }
    }
    const timer = window.setTimeout(markVisible, 350);
    area.addEventListener("scroll", markVisible);
    window.addEventListener("focus", markVisible);
    window.addEventListener("resize", markVisible);
    return () => { controller.abort(); clearTimeout(timer); area.removeEventListener("scroll", markVisible); window.removeEventListener("focus", markVisible); window.removeEventListener("resize", markVisible); };
  }, [data.messages, endpoint]);

  async function loadOlder() {
    if (!data.olderCursor || olderLoading) return;
    setOlderLoading(true);
    keepBottom.current = false;
    const previousHeight = scroll.current?.scrollHeight ?? 0;
    const previousTop = scroll.current?.scrollTop ?? 0;
    try {
      const response = await fetch(`${endpoint}?cursor=${encodeURIComponent(data.olderCursor)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const older: ChatPageDto = await response.json();
      older.messages.forEach((message) => seenMessageIds.current.add(message.id));
      setData((old) => ({ ...old, messages: mergeMessages(older.messages, old.messages), olderCursor: older.olderCursor }));
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = previousTop + scroll.current.scrollHeight - previousHeight; });
    } catch { setError("Mesajele mai vechi nu se pot încărca. Încearcă din nou."); }
    finally { setOlderLoading(false); }
  }

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    if (requestId.current?.text !== message) requestId.current = { text: message, id: crypto.randomUUID() };
    setSending(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message, clientId: requestId.current!.id }) });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Mesajul nu a putut fi trimis.");
        if (result.code === "CHAT_CLOSED") setData((old) => ({ ...old, conversation: { ...old.conversation, canSend: false } }));
        return;
      }
      keepBottom.current = true;
      setData((old) => ({ ...old, messages: mergeMessages(old.messages, [result.message]) }));
      setText("");
      requestId.current = null;
      window.dispatchEvent(new Event(CHAT_CHANGED_EVENT));
    } catch { setError("Conexiunea a fost întreruptă. Textul a fost păstrat; poți încerca din nou."); }
    finally { setSending(false); requestAnimationFrame(() => input.current?.focus()); }
  }
  const conversation = data.conversation;
  return <section className="flex min-h-0 min-w-0 flex-col" aria-label={`Conversație cu ${conversation.counterpartName}`}>
    <header className="chat-conversation-header shrink-0 border-b px-4 py-3 sm:px-5">
      <Link href="/cont/mesaje" className="chat-back mb-2 inline-block text-sm underline-offset-4 hover:underline md:hidden">&lt; Înapoi la mesaje</Link>
      <h2 className="truncate text-lg font-semibold" title={conversation.counterpartName}>{conversation.counterpartName}</h2>
      <Link href={`/cont/programari/${encodeURIComponent(conversation.appointmentSlug)}`} title={conversation.treatment} className="chat-appointment-link mt-1 block truncate text-sm text-muted-foreground underline-offset-4 hover:underline">{conversation.treatment} · {new Date(conversation.startsAt).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" })} &gt;</Link>
      {conversation.past ? <p className="mt-2 text-xs text-muted-foreground">Conversație trecută{conversation.canSend && conversation.closesAt ? ` · Poți scrie până la ${new Date(conversation.closesAt).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "short" })}` : " · Doar citire"}</p> : null}
    </header>
    {connectionError ? <p className="shrink-0 border-b px-4 py-2 text-sm text-destructive" role="status">Actualizarea mesajelor este întreruptă. Verifică conexiunea.</p> : null}
    <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5" onScroll={() => {
      if (!scroll.current) return;
      keepBottom.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 80;
      if (keepBottom.current) setUnseenCount(0);
    }} tabIndex={0} aria-label="Istoricul mesajelor">
      {data.olderCursor ? <div className="mb-4 text-center"><Button size="sm" variant="ghost" disabled={olderLoading} onClick={loadOlder}>{olderLoading ? "Se încarcă…" : "Încarcă mesaje mai vechi"}</Button></div> : null}
      {!data.messages.length ? <p className="mx-auto max-w-sm py-12 text-center text-sm text-muted-foreground">Aici puteți discuta detaliile programării. Trimite primul mesaj pentru a începe conversația.</p> : null}
      <div className="space-y-3" role="log" aria-live="polite" aria-relevant="additions">
        {data.messages.map((message) => <div key={message.id} className={cn("flex", message.own ? "justify-end" : "justify-start")} data-unread-message={!message.own && !message.readAt ? message.id : undefined}>
          <div className={cn("max-w-[90%] rounded-2xl border px-3 py-2 sm:max-w-[80%]", message.own ? "border-primary/20 bg-primary/10" : "bg-muted/40")}>
            <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{message.text}</p>
            <p className="mt-1 text-right text-[11px] text-muted-foreground"><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>{message.own ? ` · ${message.readAt ? "Citit" : "Trimis"}` : ""}</p>
          </div>
        </div>)}
      </div>
    </div>
    {unseenCount > 0 ? <div className="shrink-0 border-t px-4 py-2 text-center" role="status"><Button size="sm" variant="secondary" onClick={() => {
      keepBottom.current = true;
      if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
      setUnseenCount(0);
    }}>{unseenCount === 1 ? "Un mesaj nou" : `${unseenCount} mesaje noi`} · Vezi ultimele mesaje</Button></div> : null}
    <div className="chat-composer shrink-0 border-t bg-card p-3 sm:p-4">
      {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      {conversation.canSend ? <form onSubmit={send}>
        <label htmlFor="chat-message" className="sr-only">Mesajul tău</label>
        <textarea ref={input} id="chat-message" value={text} onChange={(e) => setText(e.target.value)} maxLength={CHAT_MAX_LENGTH} disabled={sending} rows={3} placeholder="Scrie un mesaj…" className="chat-input block w-full resize-none rounded-xl border bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm" />
        <div className="chat-composer-actions mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{text.length} / 2.000</span><Button type="submit" disabled={sending || !text.trim()}><Send className="size-4" aria-hidden="true" />{sending ? "Se verifică mesajul…" : "Trimite"}</Button></div>
        <p className="chat-disclosure mt-3 text-xs leading-relaxed text-muted-foreground"><span className="chat-disclosure-full">Mesajele sunt verificate automat prin OpenAI înainte de trimitere. Mesajele identificate ca abuzive sunt blocate. </span><span className="chat-disclosure-short">Verificare automată prin OpenAI. </span><Link href="/cont/mesaje/despre-verificare" className="underline underline-offset-2">Despre verificare</Link></p>
      </form> : <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><LockKeyhole className="size-4 shrink-0" aria-hidden="true" />Au trecut cele 7 zile. Istoricul rămâne disponibil pentru citire.</p>}
    </div>
  </section>;
}
