"use client";
import { useEffect, useRef, useState } from "react";
import { Leaderboard, NextMatch, ShareButton, track, useSaved } from "@/components/client";
import { Bug, Plate } from "@/components/Chrome";
import { Poll } from "@/components/Poll";
import { RemindMe } from "@/components/RemindMe";
import { SignInNudge } from "@/components/account";
import { YourRecord } from "@/components/record";
import { FinishMoment } from "@/components/FinishMoment";
import { HIT_EMOJI, sharePath, wordleCode, type Hit as ShareHit } from "@/lib/share";
import type { Row } from "@/lib/wordle";
import { ClueHeads, ClueRow, GUESSES, boardLabel, rowHits } from "./Clues";

interface Saved {
  rows: Row[];
  answer: Row | null;
}
interface Found {
  id: number;
  name: string;
  aka?: string;
}

const START: Saved = { rows: [], answer: null };

export default function WordleGame({ day, number }: { day: string; number: number }) {
  const [saved, save, loaded] = useSaved<Saved>(`push:wordle:${day}`, START);
  if (!loaded) return <Bug />;
  const over = !!saved.answer;
  const left = GUESSES - saved.rows.length;

  async function guess(hit: Found): Promise<string | null> {
    const guesses = [...saved.rows.map((r) => r.id), hit.id];
    const r = await fetch("/api/wordle/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guesses }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!r?.row) return "That didn't go through. Try again.";
    if (!saved.rows.length) track("wordle:start");
    if (r.answer) track("wordle:finish");
    save({ rows: [...saved.rows, r.row], answer: r.answer ?? null });
    return null;
  }

  return (
    <>
      <Bug>
        <Plate tone="dark">Wordle · No. {number}</Plate>
      </Bug>
      <main className="wrap">
        <div className="wd-top">
          <h1 className="chrome">Wrestling Wordle</h1>
          {!over && (
            <div className="corner">
              <span className="num">{left}</span>
              <span className="caps">guesses</span>
            </div>
          )}
        </div>
        {!over && <Search used={saved.rows.map((r) => r.id)} onGuess={guess} />}
        <div className="wd-board" aria-live="polite">
          {saved.rows.length > 0 && <ClueHeads />}
          {saved.rows.map((r, i) => (
            <ClueRow key={r.id} row={r} n={i + 1} />
          ))}
        </div>
        {!over && (
          <ul className="rules">
            <li><b>Name the mystery wrestler</b> in eight guesses. A new one every night.</li>
            <li><b>Green</b> is a match. <b>Gold</b> is close: some of the same promotions, or some of the same big wins.</li>
            <li><b>▲ Later / ▼ Earlier</b> on Era: the answer started in a later or earlier decade. <b>▲ More / ▼ Fewer</b> on World titles: the answer has more or fewer.</li>
            <li><b>Promotions</b> light up green where the answer worked too. <b>RR</b> won the Royal Rumble, <b>WM</b> main-evented WrestleMania, <b>AEW</b> main-evented an AEW pay-per-view.</li>
            <li><b>World titles</b> counts WWE, World Heavyweight, Universal, WCW, ECW and AEW world titles held.</li>
          </ul>
        )}
        {over && <Results day={day} number={number} rows={saved.rows} answer={saved.answer!} />}
      </main>
    </>
  );
}

function Search({ used, onGuess }: { used: number[]; onGuess: (hit: Found) => Promise<string | null> }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/ring/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then(setHits)
        .catch(() => {});
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="wd-search">
      <input
        ref={input}
        className="search"
        placeholder="Search wrestlers"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setErr("");
        }}
      />
      {err && <div className="miss">{err}</div>}
      {hits.length > 0 && (
        <ul className="results">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                disabled={busy || used.includes(h.id)}
                onClick={async () => {
                  setBusy(true);
                  const e = await onGuess(h);
                  setBusy(false);
                  if (e) return setErr(e);
                  setQ("");
                  setHits([]);
                  input.current?.focus();
                }}
              >
                {h.name}
                {h.aka && <small>aka {h.aka}</small>}
                {used.includes(h.id) && <small>already guessed</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Results({ day, number, rows, answer }: { day: string; number: number; rows: Row[]; answer: Row }) {
  const solvedIn = rows[rows.length - 1]?.id === answer.id ? rows.length : 0;
  const hits = rows.map((r) => rowHits(r).map((h) => h.toUpperCase() as ShareHit));
  const score = solvedIn ? `${solvedIn}/${GUESSES}` : `X/${GUESSES}`;
  const share = `THE PUSH · Wrestling Wordle No. ${number}\n${hits.map((r) => r.map((h) => HIT_EMOJI[h]).join("")).join("\n")}\n${score}`;
  const shareProps = {
    game: "wordle" as const,
    text: share,
    path: sharePath("wordle", number, wordleCode(solvedIn, hits)),
    teaser: "Sends your clue grid (no names, no spoilers) and a link to tonight's Wrestling Wordle.",
    dare: solvedIn ? "Can you get it in fewer?" : "Can you name them?",
  };
  return (
    <section>
      <div className="final">
        <Plate tone="gold">Wrestling Wordle · Final</Plate>
        <div className="num score">{score}</div>
        <div className="sub">{solvedIn ? `Got it in ${solvedIn}` : "Out of guesses"} · It was {answer.name}</div>
      </div>
      {!solvedIn && (
        <div className="wd-board wd-answer">
          <ClueHeads />
          <ClueRow row={answer} label="The answer" />
        </div>
      )}
      <ShareButton {...shareProps} />
      <FinishMoment
        storageKey={`push:moment:wordle:${day}`}
        label={`Wrestling Wordle · No. ${number}`}
        score={solvedIn}
        of={GUESSES}
        sub={solvedIn ? `It was ${answer.name}` : `Out of guesses · It was ${answer.name}`}
        share={shareProps}
      />
      <YourRecord />
      <div className="stack">
        <Leaderboard game="wordle" day={day} payload={{ guesses: rows.map((r) => r.id) }} format={boardLabel} />
      </div>
      <Poll />
      <RemindMe />
      <SignInNudge />
      <NextMatch to="ring" />
    </section>
  );
}
