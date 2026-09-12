"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { compactHeaderIconControlClassName, headerNeutralControlClassName } from "@/components/layout/header-action-styles";
import { cn } from "@/lib/utils";
import { useUnreadChatCount } from "./chat-notifications-provider";

export function HeaderMessages() {
  const count = useUnreadChatCount();
  return (
    <Link href="/cont/mesaje" prefetch={false} className={cn(headerNeutralControlClassName, "relative inline-flex shrink-0 items-center gap-2 px-2 sm:px-3", compactHeaderIconControlClassName)} aria-label={count === 1 ? "Mesaje: o conversație cu mesaje necitite" : count ? `Mesaje: ${count} conversații cu mesaje necitite` : "Mesaje"}>
      <MessageCircle className="size-5" aria-hidden="true" /><span className="hidden text-sm font-medium lg:inline">Mesaje</span>
      {count > 0 ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
