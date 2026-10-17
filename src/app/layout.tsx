import type { Metadata, Viewport } from "next";
import { Saira_Condensed, Teko } from "next/font/google";
import { Ticker } from "@/components/Chrome";
import "./globals.css";

const display = Teko({ variable: "--font-display", weight: ["500", "600", "700"], subsets: ["latin"] });
const ui = Saira_Condensed({ variable: "--font-ui", weight: ["500", "700", "800"], subsets: ["latin"] });

const description = "Daily wrestling trivia: five questions, fifteen seconds each, and the Immaculate Ring. New card every night.";

export const metadata: Metadata = {
  // absolute base for the share-banner URL; update when the real domain is live
  metadataBase: new URL("https://the-push-wrestling.vercel.app"),
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
          Not affiliated with any promotion. A <a href="https://dahvio.com">DahVio Studios</a> production.
        </footer>
        <Ticker />
      </body>
    </html>
  );
}
