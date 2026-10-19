import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { YourLeagues } from "@/components/league";

export const metadata: Metadata = { title: "Leagues · The Push", robots: { index: false } };

// /league: the leagues this device is in, and the way to start one.
export default function LeaguesPage() {
  return (
    <>
      <Bug>
        <Plate tone="dark">League</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Friend leagues</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(48px, 12vw, 76px)", marginTop: 14 }}>
            Your leagues.
          </h1>
        </div>
        <YourLeagues />
        <div className="stack">
          <Link className="cta full" href="/league/new">
            <span>Start a league</span>
          </Link>
        </div>
      </main>
    </>
  );
}
