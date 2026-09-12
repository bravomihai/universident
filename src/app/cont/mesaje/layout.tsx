import type { ReactNode } from "react";
import type { Viewport } from "next";

// Supporting mobile browsers give the layout the space left above the keyboard.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
