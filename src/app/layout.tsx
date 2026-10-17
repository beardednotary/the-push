import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Ticker } from "@/components/Chrome";
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

const description = "Daily wrestling trivia: five questions, fifteen seconds each, and the Immaculate Ring. New card every night.";

export const metadata: Metadata = {
  // absolute base for share-banner and share-card URLs
  metadataBase: new URL("https://playthepush.com"),
  title: "The Push: daily wrestling games",
  description,
  openGraph: { title: "The Push", description, siteName: "The Push", type: "website" },
  twitter: { card: "summary_large_image", title: "The Push", description },
};

export const viewport: Viewport = { themeColor: "#07080b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${ui.variable}`}>
        {children}
        <footer className="footer">
          Data: <a href="https://www.kaggle.com/datasets/theodorerubin/ringside-wrestling-archive">Ringside Wrestling Archive</a>.
          Not affiliated with any promotion. A <a href="https://dahvio.com">DahVio Studios</a> production.{" "}
          <a href="/privacy">Privacy</a>
        </footer>
        <Ticker />
      </body>
    </html>
  );
}
