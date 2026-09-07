import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BrandFaviconLinks } from "@/components/layout/brand-favicon-links";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeFavicon } from "@/components/theme/theme-favicon";

import "./globals.css";
import "./site-theme.css";
import "./ui-system.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Universident",
    template: "%s | Universident",
  },
  description:
    "Universident conectează pacienții cu studenți la medicină dentară, pentru tratamente sub supervizare.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <BrandFaviconLinks />
      </head>
      <body className="universident-app flex min-h-full flex-col">
        <a className="skip-to-content" href="#main-content">Mergi la conținut</a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeFavicon />
          <SiteHeader />
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
