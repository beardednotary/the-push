"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaderboard, NextMatch, ShareButton, useSaved } from "@/components/client";
import { Bug, Plate } from "@/components/Chrome";
import { SECONDS_PER_QUESTION, pointsFor } from "@/lib/scoring";

interface Q {
  id: string;
  prompt: string;
  options: string[];
}
interface Answered {
  choice: number | null;
  ms: number;
  answer: number;
}
interface Saved {
  answers: Answered[];
  startedAt: number | null; // wall clock when the current question appeared
}

const LIMIT = SECONDS_PER_QUESTION * 1000;
const KEYS = ["A", "B", "C", "D"];

export default function FiveGame({ day, number, questions }: { day: string; number: number; questions: Q[] }) {
  const [saved, save, loaded] = useSaved<Saved>(`push:five:${day}`, { answers: [], startedAt: null });
  const [elapsed, setElapsed] = useState(0);
  const [reveal, setReveal] = useState<Answered | null>(null);
  const locked = useRef(false);

  const index = saved.answers.length;
  const done = index >= questions.length;
  const playing = saved.startedAt !== null && !done;

  const commit = useCallback(
    async (choice: number | null) => {
      if (locked.current || saved.startedAt === null) return;
      locked.current = true;
      const ms = Math.min(LIMIT, Date.now() - saved.startedAt);
      const r = await fetch("/api/five/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, choice }),
      }).then((r) => r.json());
      const a: Answered = { choice, ms, answer: r.answer };
      setReveal(a);
      setTimeout(() => {
        const answers = [...saved.answers, a];
        save({ answers, startedAt: answers.length < questions.length ? Date.now() : null });
        setReveal(null);
        setElapsed(0);
        locked.current = false;
      }, 1400);
    },
    [index, questions.length, save, saved],
  );

  // wall-clock timer, so a refresh doesn't buy extra time
  useEffect(() => {
    if (!playing || reveal) return;
    let raf = 0;
    const tick = () => {
      const e = Date.now() - (saved.startedAt ?? Date.now());
      setElapsed(e);
      if (e >= LIMIT) commit(null);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reveal, saved.startedAt, commit]);

  if (!loaded) return <Bug />;

  if (!playing && !done) {
    return (
      <>
        <Bug>
          <Plate tone="dark">Five · No. {number}</Plate>
        </Bug>
        <main className="wrap">
          <div className="headline">
            <Plate tone="gold">Opening contest</Plate>
            <h1 className="chrome" style={{ fontSize: "clamp(56px, 16vw, 92px)", marginTop: 14 }}>
              Five questions.
              <br />
              Fifteen seconds.
            </h1>
          </div>
          <ul className="rules">
            <li>
              <b>100 points</b> for every right answer, plus <b>up to 100 more</b> for speed.
            </li>
            <li>The clock is in the corner. When it hits zero, you&apos;re pinned.</li>
            <li>One attempt a night. A new card drops at midnight Eastern.</li>
          </ul>
          <button className="cta full" onClick={() => save({ answers: [], startedAt: Date.now() })}>
            <span>Ring the bell</span>
          </button>
        </main>
      </>
    );
  }

  if (done) return <Results day={day} number={number} questions={questions} answers={saved.answers} />;

  const q = questions[index];
  const left = Math.min(LIMIT, Math.max(0, LIMIT - elapsed));
  const secsLeft = Math.ceil(left / 1000);
  const shown = reveal;
  const total = saved.answers.reduce((s, a) => s + pointsFor(a.choice === a.answer, a.ms), 0);

  return (
    <>
      <Bug>
        <Plate tone="clock">0:{String(shown ? 0 : secsLeft).padStart(2, "0")}</Plate>
      </Bug>
      <main className="wrap">
        <div className="q-top">
          <Plate tone="gold">
            Question {index + 1} / {questions.length}
          </Plate>
          <Plate tone="dark">{total} pts</Plate>
        </div>
        <div className={`bar${secsLeft <= 3 ? " low" : ""}`} aria-label={`${secsLeft} seconds left`}>
          <i style={{ transform: `scaleX(${shown ? 0 : left / LIMIT})` }} />
        </div>
        <p className="prompt" key={q.id}>
          {q.prompt}
        </p>
        <div className="lowers" key={`${q.id}-o`}>
          {q.options.map((opt, i) => {
            let cls = "lower";
            if (shown && i === shown.answer) cls += " right";
            else if (shown && i === shown.choice) cls += " wrong";
            return (
              <button key={opt} className={cls} disabled={!!shown} onClick={() => commit(i)}>
                <span>
                  <b>{KEYS[i]}</b>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flash" aria-live="polite">
          {shown && shown.choice === shown.answer && <Plate tone="gold">+{pointsFor(true, shown.ms)}</Plate>}
          {shown && shown.choice !== null && shown.choice !== shown.answer && <Plate tone="red">Wrong</Plate>}
        </div>
        {!shown && secsLeft <= 3 && secsLeft > 0 && (
          <div className="count">
            <span className="num">{secsLeft}</span>
          </div>
        )}
        {shown && shown.choice === null && (
          <div className="count">
            <Plate tone="red">Pinned</Plate>
          </div>
        )}
      </main>
    </>
  );
}

function square(a: Answered) {
  if (a.choice === null) return "⬛";
  if (a.choice !== a.answer) return "🟥";
  return pointsFor(true, a.ms) >= 150 ? "🟩" : "🟨";
}

function Results({ day, number, questions, answers }: { day: string; number: number; questions: Q[]; answers: Answered[] }) {
  const pts = answers.map((a) => pointsFor(a.choice === a.answer, a.ms));
  const total = pts.reduce((a, b) => a + b, 0);
  const right = answers.filter((a) => a.choice === a.answer).length;
  const share = `THE PUSH · Daily Five No. ${number}\n${answers.map(square).join("")}  ${total}/1000`;
  return (
    <>
      <Bug>
        <Plate tone="dark">Final</Plate>
      </Bug>
      <main className="wrap">
        <div className="final">
          <Plate tone="gold">Daily Five · No. {number} · Final</Plate>
          <div className="num score">{total}</div>
          <div className="sub">
            Out of 1000 · {right} of 5 right
          </div>
        </div>
        <ol className="recap">
          {questions.map((q, i) => {
            const a = answers[i];
            const ok = a.choice === a.answer;
            return (
              <li key={q.id} className={ok ? "ok" : "no"}>
                <span>
                  {q.prompt}
                  <small>
                    {ok ? q.options[a.answer] : `${a.choice === null ? "Time ran out" : `You said ${q.options[a.choice]}`} · answer: ${q.options[a.answer]}`}
                    {" · "}
                    {(a.ms / 1000).toFixed(1)}s
                  </small>
                </span>
                <span className="num">{pts[i]}</span>
              </li>
            );
          })}
        </ol>
        <div className="stack">
          <ShareButton text={share} />
          <Leaderboard game="five" day={day} payload={{ answers: answers.map(({ choice, ms }) => ({ choice, ms })) }} format={(s) => String(s)} />
        </div>
        <NextMatch to="ring" />
      </main>
    </>
  );
}
