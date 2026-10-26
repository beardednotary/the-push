"use client";
// Poll of the night: tap an answer (or write your own), then see how everyone voted and share
// it. One vote per device. Write-ins show as one bar; their text is only on /stats.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId, shareUrl, track, useSaved } from "./client";
import type { Poll as PollData } from "@/lib/polls";

const WRITE_IN_MAX = 40; // matches lib/polls

export function Poll() {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [mine, setMine, loaded] = useSaved<number | null>(`push:poll:${poll?.day ?? "none"}`, null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

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
  const writeIn = poll.options.length; // the write-ins' index
  const voted = mine !== null;
  const total = counts.reduce((a, b) => a + b, 0);
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);
  const rows = [...poll.options, "Write-ins"].map((label, i) => ({ label, i, n: counts[i] ?? 0 })).filter((r) => r.i < writeIn || r.n > 0 || r.i === mine);

  async function pick(option: number, typed?: string) {
    setMine(option);
    track("poll:vote");
    setCounts((c) => Array.from({ length: writeIn + 1 }, (_, i) => (c[i] ?? 0) + (i === option ? 1 : 0))); // show it at once; the server's count follows
    const r = await fetch("/api/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId(), option, text: typed }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (r?.counts?.length) setCounts(r.counts);
  }

  async function share() {
    if (!poll || mine === null) return;
    const picked = mine === writeIn ? "I wrote in my own answer." : `I picked ${poll.options[mine]} (${pct(counts[mine] ?? 0)}% agree).`;
    const body = `🗳️ Poll of the night, No. ${poll.n}: ${poll.question}\n${picked}\nWhat's yours?`;
    const url = shareUrl("/poll", "poll");
    if (navigator.share) {
      try {
        await navigator.share({ text: body, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // closed the share sheet
      }
    }
    await navigator.clipboard.writeText(`${body}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="poll">
      <div className="section-head">
        <Plate tone="gold">Poll of the night</Plate>
        <Plate tone="dark">No. {poll.n}</Plate>
      </div>
      <h2 className="q">{poll.question}</h2>
      {voted ? (
        <>
          <div className="opts">
            {rows.map((r) => (
              <div key={r.i} className={`opt${r.i === mine ? " mine" : ""}`}>
                <i style={{ width: `${pct(r.n)}%` }} />
                <span>{r.label}</span>
                <span className="pct">{pct(r.n)}%</span>
              </div>
            ))}
          </div>
          <button className="cta gold full" style={{ marginTop: 12 }} onClick={share}>
            <span>{copied ? "Copied. Paste it anywhere" : "Share the poll"}</span>
          </button>
        </>
      ) : (
        <div className="opts">
          {poll.options.map((o, i) => (
            <button key={i} className="opt" onClick={() => pick(i)}>
              <span>{o}</span>
            </button>
          ))}
          {writing ? (
            <form
              className="post"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) pick(writeIn, text);
              }}
            >
              <input className="field" placeholder="Your answer" value={text} maxLength={WRITE_IN_MAX} onChange={(e) => setText(e.target.value)} autoFocus required />
              <button className="cta ghost">
                <span>Vote</span>
              </button>
            </form>
          ) : (
            <button className="opt other" onClick={() => setWriting(true)}>
              <span>Something else…</span>
            </button>
          )}
        </div>
      )}
      <p className="muted small">
        {voted ? `${total} vote${total === 1 ? "" : "s"} so far. ` : "Tap your pick to see how everyone voted. "}
        <Link className="gold" href="/polls">
          Past polls
        </Link>
      </p>
    </section>
  );
}
