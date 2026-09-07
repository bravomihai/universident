"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

import { Card } from "@/components/ui/card";
import { centeredAnchorMargin } from "@/lib/navigation/centered-anchor-margin";

export function HowItWorksCard({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const header = document.querySelector<HTMLElement>(".site-header");
    const viewport = window.visualViewport;

    const updateAnchorMargin = () => {
      const margin = centeredAnchorMargin({
        viewportHeight: viewport?.height ?? window.innerHeight,
        targetHeight: card.getBoundingClientRect().height,
        headerHeight: header?.getBoundingClientRect().height ?? 0,
        scrollPaddingTop: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
      });
      card.style.setProperty("--how-anchor-margin", `${margin}px`);
    };

    updateAnchorMargin();
    const observer = new ResizeObserver(updateAnchorMargin);
    observer.observe(card);
    if (header) observer.observe(header);
    window.addEventListener("resize", updateAnchorMargin);
    viewport?.addEventListener("resize", updateAnchorMargin);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateAnchorMargin);
      viewport?.removeEventListener("resize", updateAnchorMargin);
    };
  }, []);

  return (
    <Card ref={cardRef} id="cum-functioneaza" className="home-how-panel">
      {children}
    </Card>
  );
}
