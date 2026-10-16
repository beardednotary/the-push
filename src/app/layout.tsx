import type { Metadata, Viewport } from "next";
import { Saira_Condensed, Teko } from "next/font/google";
import { Ticker } from "@/components/Chrome";
import "./globals.css";

const display = Teko({ variable: "--font-display", weight: ["500", "600", "700"], subsets: ["latin"] });
const ui = Saira_Condensed({ variable: "--font-ui", weight: ["500", "700", "800"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Push: daily wrestling games",
  description: "A daily wrestling trivia card: five timed questions and the Immaculate Ring grid.",
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
