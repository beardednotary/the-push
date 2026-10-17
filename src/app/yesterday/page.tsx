import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { addDays, prettyDay, puzzleNumber, todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { frozenFive, frozenRing } from "@/lib/cards";
import { ringPicks } from "@/lib/picks";
import { readStats } from "@/lib/stats";
import { ringBoardLabel } from "@/lib/scoring";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/yesterday",
  "Yesterday's card · The Push",
  "Yesterday's Daily Five answers, how everyone did, and the full Immaculate Ring answer key.",
);

const KEYS = ["A", "B", "C", "D"];

async function champions(game: "five" | "ring", day: string) {
  const top = await store.top(`lb:${game}:${day}`, 3);
  const names = await store.names(top.map((t) => t.member));
  return top.map((t) => ({ name: names[t.member] ?? "Anonymous", score: t.score }));
}

export default async function YesterdayPage() {
  const day = addDays(todayKey(), -1);
  const number = puzzleNumber(day);
  const [questions, grid] = await Promise.all([frozenFive(day), frozenRing(day)]);
  if (number < 1 || !questions || !grid) {
    return (
      <>
        <Bug>
          <Plate tone="dark">Yesterday</Plate>
        </Bug>
        <main className="wrap">
          <p className="muted" style={{ marginTop: 40 }}>
            Replays start with tonight&apos;s card. Check back tomorrow for the answers, how everyone did and the full
            Immaculate Ring answer key.
          </p>
        </main>
      </>
    );
  }

  const [stats, picks, fiveChamps, ringChamps] = await Promise.all([
    readStats(day),
    ringPicks(day, grid, 6),
    champions("five", day),
    champions("ring", day),
  ]);

  return (
    <>
      <Bug>
        <Plate tone="dark">Yesterday · No. {number}</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Card No. {number} · {prettyDay(day)}</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The replay.
          </h1>
        </div>
        <p className="muted">Answers, how everyone did, and who won. Tonight&apos;s card is already live.</p>
        <Link className="cta" href="/">
          <span>Tonight&apos;s card</span>
        </Link>

        <div className="section-head" style={{ marginTop: 34 }}>
          <Plate tone="gold">Champions</Plate>
        </div>
        <div className="champs">
          <div>
            <p className="caps muted">Daily Five</p>
            {fiveChamps.length ? fiveChamps.map((c, i) => <p key={i}><b>{i + 1}.</b> {c.name} <span className="num gold">{c.score}</span></p>) : <p className="muted">No ranked scores.</p>}
          </div>
          <div>
            <p className="caps muted">Immaculate Ring</p>
            {ringChamps.length ? ringChamps.map((c, i) => <p key={i}><b>{i + 1}.</b> {c.name} <span className="num gold">{ringBoardLabel(c.score)}</span></p>) : <p className="muted">No ranked scores.</p>}
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 30 }}>
          <Plate tone="gold">Daily Five</Plate>
          <Plate tone="dark">Answers</Plate>
        </div>
        <ol className="replay">
          {questions.map((q, i) => {
            const counts = q.options.map((_, o) => stats[`five:q${i}:o${o}`] ?? 0);
            const timeouts = stats[`five:q${i}:timeout`] ?? 0;
            const total = counts.reduce((a, b) => a + b, 0) + timeouts;
            const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);
            return (
              <li key={q.id}>
                <p className="q">{q.prompt}</p>
                {q.options.map((o, oi) => (
                  <div key={oi} className={`opt${oi === q.answer ? " right" : ""}`}>
                    <i style={{ width: `${pct(counts[oi])}%` }} />
                    <span>
                      <b>{KEYS[oi]}</b> {o}
                    </span>
                    {total > 0 && <span className="pct">{pct(counts[oi])}%</span>}
                  </div>
                ))}
                {total > 0 ? (
                  <p className="muted small">
                    {pct(counts[q.answer])}% got it right{timeouts ? ` · ${pct(timeouts)}% ran out of time` : ""}
                  </p>
                ) : (
                  <p className="muted small">No answers recorded.</p>
                )}
              </li>
            );
          })}
        </ol>

        <div className="section-head" style={{ marginTop: 30 }}>
          <Plate tone="gold">Immaculate Ring</Plate>
          <Plate tone="dark">Answer key</Plate>
        </div>
        <div className="keylist">
          {grid.rows.flatMap((r, ri) =>
            grid.cols.map((c, ci) => {
              const p = picks[ri * 3 + ci];
              const topNames = new Set(p.top.map((t) => t.name));
              const more = p.examples.filter((n) => !topNames.has(n)).slice(0, 4);
              return (
                <div key={`${ri}-${ci}`} className="key">
                  <p className="caps">
                    <span className="r">{r.label}</span> × <span className="c">{c.label}</span>
                  </p>
                  {p.top.length > 0 && (
                    <p>
                      <b>Most picked:</b> {p.top.map((t) => `${t.name} (${t.pct}%)`).join(", ")}
                    </p>
                  )}
                  {more.length > 0 && (
                    <p className="muted">
                      <b>Also right:</b> {more.join(", ")}
                    </p>
                  )}
                  <p className="muted small">{p.possible} wrestlers would have counted.</p>
                </div>
              );
            }),
          )}
        </div>
      </main>
    </>
  );
}
