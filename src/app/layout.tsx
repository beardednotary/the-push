import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AccountLink } from "@/components/account";
import { Ticker } from "@/components/Chrome";
import { Tracking } from "@/components/Tracking";
import { SITE_DESCRIPTION, pageMeta } from "@/lib/meta";
import "./globals.css";

// Self-hosted (src/fonts, OFL) so builds never depend on fetching from Google Fonts.
const display = localFont({
  variable: "--font-display",
  src: [
    { path: "../fonts/teko-500.woff2", weight: "500" },
    { path: "../fonts/teko-600.woff2", weight: "600" },
    { path: "../fonts/teko-700.woff2", weight: "700" },
  ],
});
const ui = localFont({
  variable: "--font-ui",
  src: [
    { path: "../fonts/saira-condensed-500.woff2", weight: "500" },
    { path: "../fonts/saira-condensed-700.woff2", weight: "700" },
    { path: "../fonts/saira-condensed-800.woff2", weight: "800" },
  ],
});

export const metadata: Metadata = {
  // absolute base for share-banner and share-card URLs
  metadataBase: new URL("https://playthepush.com"),
  ...pageMeta("/", "The Push: daily wrestling games (grid, Wordle and trivia)"),
  openGraph: { title: "The Push", description: SITE_DESCRIPTION, url: "/", siteName: "The Push", type: "website" },
};

export const viewport: Viewport = { themeColor: "#07080b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${ui.variable}`}>
        {children}
        <footer className="footer">
          Match results from <a href="https://www.cagematch.net">CAGEMATCH</a>, used with permission, via the{" "}
          <a href="https://www.kaggle.com/datasets/theodorerubin/ringside-wrestling-archive">Ringside Wrestling Archive</a>. Also{" "}
          <a href="https://www.wikidata.org">Wikidata</a> and <a href="https://en.wikipedia.org/wiki/Category:Lists_of_professional_wrestling_champions">Wikipedia</a> championship lists.
          Not affiliated with any promotion. A <a href="https://dahvio.com">DahVio Studios</a> production.{" "}
          <a href="/archive">Archive</a> <a href="/grid">Grid guide</a> <a href="/league">Leagues</a> <a href="https://discord.gg/hQNuKJva8W">Discord</a> <a href="/privacy">Privacy</a> <AccountLink />
        </footer>
        <Ticker />
        <Tracking />
      </body>
    </html>
  );
}
