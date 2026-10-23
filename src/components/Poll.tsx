"use client";
// Poll of the night: tap an answer, then see how everyone voted. One vote per device.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId, useSaved } from "./client";
import type { Poll as PollData } from "@/lib/polls";

export function Poll() {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [mine, setMine, loaded] = useSaved<number | null>(`push:poll:${poll?.day ?? "none"}`, null);

  useEffect(() => {
    fetch("/api/poll")
      .then((r) => r.json())
      .then((d) => {
        setPoll(d.poll);
        setCounts(d.counts);
      })
      .catch(() => {});
  }, []);

  if (!poll || !loaded) return null;
  const voted = mine !== null;
  const total = counts.reduce((a, b) => a + b, 0);
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);

  async function pick(option: number) {
    setMine(option);
    setCounts((c) => c.map((n, i) => (i === option ? n + 1 : n))); // show it at once; the server's count follows
    const r = await fetch("/api/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId(), option }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (r?.counts?.length) setCounts(r.counts);
  }

  return (
    <section className="poll">
      <div className="section-head">
        <Plate tone="gold">Poll of the night</Plate>
        <Plate tone="dark">No. {poll.n}</Plate>
      </div>
      <h2 className="q">{poll.question}</h2>
      <div className="opts">
        {poll.options.map((o, i) =>
          voted ? (
            <div key={i} className={`opt${i === mine ? " mine" : ""}`}>
              <i style={{ width: `${pct(counts[i] ?? 0)}%` }} />
              <span>{o}</span>
              <span className="pct">{pct(counts[i] ?? 0)}%</span>
            </div>
          ) : (
            <button key={i} className="opt" onClick={() => pick(i)}>
              <span>{o}</span>
            </button>
          ),
        )}
      </div>
      <p className="muted small">
        {voted ? `${total} vote${total === 1 ? "" : "s"} so far. ` : "Tap your pick to see how everyone voted. "}
        <Link className="gold" href="/polls">
          Past polls
        </Link>
      </p>
    </section>
  );
}
