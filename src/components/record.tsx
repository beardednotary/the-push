"use client";
// "Your record" on the results screens: Iron Man streak, rank, and belts.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId } from "./client";

interface Record {
  career: { games: number; streak: number; best: number; rank: string };
  signedIn: boolean;
  belts: { id: string; name: string; reigns: number; holding: boolean }[];
}

const NEXT: [number, string][] = [
  [5, "Enhancement Talent"],
  [15, "Mid-Carder"],
  [35, "Upper Mid-Card"],
  [75, "Main Eventer"],
  [150, "Hall of Famer"],
];

export function YourRecord() {
  const [rec, setRec] = useState<Record | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/player?id=${playerId()}`)
        .then((r) => r.json())
        .then((d: Record) => {
          setRec(d);
          try {
            localStorage.setItem("push:streak", String(d.career?.streak ?? 0));
          } catch {}
        })
        .catch(() => {});
    load();
    window.addEventListener("push:career", load); // a finish was just recorded
    return () => window.removeEventListener("push:career", load);
  }, []);

  if (!rec?.career) return null;
  const { games, streak, best, rank } = rec.career;
  const next = NEXT.find(([at]) => games < at);
  const titles = rec.belts.filter((b) => b.reigns > 0);
  return (
    <section className="record">
      <div className="section-head">
        <Plate tone="gold">Your record</Plate>
      </div>
      <div className="record-grid">
        <div>
          <span className="num big">{streak}</span>
          <span className="caps">Iron Man streak</span>
          <small>{streak === 1 ? "day" : "days"} in a row · best {best}</small>
        </div>
        <div>
          <span className="rankname">{rank}</span>
          <span className="caps">Rank</span>
          <small>
            {games} {games === 1 ? "match" : "matches"} · {next ? `${next[0] - games} more to ${next[1]}` : "top of the card"}
          </small>
        </div>
      </div>
      {titles.length > 0 && (
        <ul className="honors">
          {titles.map((b) => (
            <li key={b.id} className={b.holding ? "holding" : ""}>
              {b.holding && <Plate tone="gold">Champion</Plate>} {b.reigns > 1 ? `${b.reigns}x ` : ""}
              {b.name}
            </li>
          ))}
        </ul>
      )}
      {!rec.signedIn && (
        <p className="muted small">
          Titles go to signed-in players. <Link href="/signin" style={{ color: "var(--gold)" }}>Sign in</Link> to fight for the
          belts. <Link href="/titles" style={{ color: "var(--gold)" }}>See the champions</Link>
        </p>
      )}
      {rec.signedIn && (
        <p className="muted small">
          You&apos;re eligible for tonight&apos;s belts. <Link href="/titles" style={{ color: "var(--gold)" }}>See the champions</Link>
        </p>
      )}
    </section>
  );
}
