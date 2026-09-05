"use client";

import { type ComponentProps, useSyncExternalStore } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeProvider({
  children,
  scriptProps,
  ...props
}: ThemeProviderProps) {
  const isClientRender = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  // Keep the no-flash script executable in SSR HTML and initial hydration.
  // Client remounts use the provider's effects; their inline script is inert.
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{
        ...scriptProps,
        type: isClientRender ? "text/plain" : scriptProps?.type,
      }}
    >
      {children}
    </NextThemesProvider>
  );
}
