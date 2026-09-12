"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { clickableCardClassName, clickableCardIndicatorClassName, clickableCardLinkClassName } from "@/components/ui/clickable-card-styles";
import { useUnreadChatCount } from "./chat-notifications-provider";

export function AccountMessagesCard({ initialCount }: { initialCount: number }) {
  const count = useUnreadChatCount(initialCount);
  return <Link href="/cont/mesaje" prefetch={false} className={clickableCardLinkClassName}>
    <Card className={`${clickableCardClassName} ${count > 0 ? "bg-primary/[0.04] ring-primary/30" : ""}`}>
      <CardContent className="relative flex h-full flex-col gap-4 sm:pr-56">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/30"><MessageCircle className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 space-y-1"><h2 className="font-semibold">Mesaje</h2><p className="text-sm text-muted-foreground">Discuțiile legate de programările tale.</p></div>
        </div>
        <p className={`text-sm ${count ? "font-semibold text-primary" : "text-muted-foreground"}`} role="status">
          {count === 1 ? "O conversație necitită" : count > 1 ? `${count} conversații necitite` : "Nu ai mesaje necitite."}
        </p>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium sm:absolute sm:right-5 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2">Vezi conversațiile<span className={clickableCardIndicatorClassName} aria-hidden="true">&gt;</span></span>
      </CardContent>
    </Card>
  </Link>;
}
