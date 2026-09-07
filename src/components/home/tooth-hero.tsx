"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ToothScene } from "./tooth-scene";

export function ToothHero() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ToothScene | null>(null);
  const { resolvedTheme } = useTheme();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const instructionsId = useId();

  useLayoutEffect(() => {
    const viewport = host.current;
    const anchor = viewport?.parentElement;
    const content = anchor?.parentElement;
    const title = anchor?.closest("section")?.querySelector("h1");
    if (!viewport || !anchor || !content || !title) return;

    let disposed = false;
    function alignToVisibleText() {
      if (disposed || !viewport || !anchor || !content || !title) return;

      // A balanced heading's box can be wider than its longest rendered line.
      // Measure text fragments, not block elements, to find the visual edge.
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let textRight = title.getBoundingClientRect().left;
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        range.selectNodeContents(walker.currentNode);
        for (const fragment of range.getClientRects()) {
          textRight = Math.max(textRight, fragment.right);
        }
      }

      const bounds = anchor.getBoundingClientRect();
      // Follow the content's right edge: it matches the viewport on small
      // screens, but stops expanding with the 1200px hero container.
      const contentRight = content.getBoundingClientRect().right;
      const targetCenter = (textRight + contentRight) / 2;
      const offset = targetCenter - (bounds.left + bounds.width / 2);
      // Transform only the canvas host; measuring the unchanged grid cell
      // prevents accumulated offsets when fonts or viewport dimensions change.
      viewport.style.setProperty("--tooth-offset-x", `${offset.toFixed(2)}px`);
    }

    alignToVisibleText();
    const observer = new ResizeObserver(alignToVisibleText);
    observer.observe(title);
    observer.observe(anchor);
    observer.observe(content);
    window.addEventListener("resize", alignToVisibleText);
    document.fonts.addEventListener("loadingdone", alignToVisibleText);
    void document.fonts.ready.then(alignToVisibleText);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", alignToVisibleText);
      document.fonts.removeEventListener("loadingdone", alignToVisibleText);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("./tooth-scene").then(({ createToothScene }) => {
      if (cancelled || !host.current) return;
      try {
        controller.current = createToothScene(host.current, () => {
          controller.current?.dispose();
          controller.current = null;
          setStatus("unavailable");
        });
        controller.current.setDark(document.documentElement.classList.contains("dark"));
        setStatus("ready");
      } catch {
        controller.current?.dispose();
        controller.current = null;
        host.current.replaceChildren();
        setStatus("unavailable");
      }
    }).catch(() => { if (!cancelled) setStatus("unavailable"); });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => { controller.current?.setDark(resolvedTheme === "dark"); }, [resolvedTheme]);

  return (
    <div className="tooth-hero" data-status={status}>
      <div
        ref={host}
        className="tooth-viewport"
        role="group"
        tabIndex={status === "ready" ? 0 : -1}
        aria-label="Dinte 3D interactiv"
        aria-describedby={instructionsId}
      />
      <span id={instructionsId} className="sr-only">
        Folosește săgețile pentru rotire. Animația se oprește cât timp modelul are focus sau cursorul este deasupra lui.
      </span>
      {status === "loading" ? <span className="sr-only" role="status">Se încarcă modelul decorativ.</span> : null}
      {status === "unavailable" ? <span className="sr-only">Modelul decorativ nu este disponibil în acest browser.</span> : null}
    </div>
  );
}
