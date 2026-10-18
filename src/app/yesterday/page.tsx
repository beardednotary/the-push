import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { addDays, prettyDay, puzzleNumber, todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { frozenFive, frozenRing } from "@/lib/cards";
import { ringPicks } from "@/lib/picks";
import { readStats } from "@/lib/stats";
import { ringBoardLabel } from "@/lib/scoring";
import { FiveAnswers, RingKey } from "@/components/Replay";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/yesterday",
  "Yesterday's card · The Push",
  "Yesterday's Daily Five answers, how everyone did, and the full Immaculate Ring answer key.",
);

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
        <FiveAnswers questions={questions} stats={stats} />

        <div className="section-head" style={{ marginTop: 30 }}>
          <Plate tone="gold">Immaculate Ring</Plate>
          <Plate tone="dark">Answer key</Plate>
        </div>
        <RingKey grid={grid} picks={picks} />
        <p className="muted" style={{ fontSize: 15 }}>
          Permanent pages for this card: <Link className="gold" href={`/ring/answers/${number}`}>Ring No. {number} answers</Link> ·{" "}
          <Link className="gold" href={`/five/answers/${number}`}>Daily Five No. {number} answers</Link> ·{" "}
          <Link className="gold" href="/archive">every past card</Link>
        </p>
      </main>
    </>
  );
}
