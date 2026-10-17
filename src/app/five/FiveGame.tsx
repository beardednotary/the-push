"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaderboard, NextMatch, ShareButton, notTracked, track, useSaved } from "@/components/client";
import { Bug, Plate } from "@/components/Chrome";
import { RemindMe } from "@/components/RemindMe";
import { SignInNudge } from "@/components/account";
import { SECONDS_PER_QUESTION, pointsFor } from "@/lib/scoring";
import { MARK_EMOJI, fiveCode, sharePath, type Mark } from "@/lib/share";

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
  untimed?: boolean; // no clock: 100 per right answer, not ranked
}

const LIMIT = SECONDS_PER_QUESTION * 1000;
const KEYS = ["A", "B", "C", "D"];

function points(a: Answered, untimed?: boolean) {
  const right = a.choice === a.answer;
  return untimed ? (right ? 100 : 0) : pointsFor(right, a.ms);
}

export default function FiveGame({ day, number, questions }: { day: string; number: number; questions: Q[] }) {
  const [saved, save, loaded] = useSaved<Saved>(`push:five:${day}`, { answers: [], startedAt: null });
  const [elapsed, setElapsed] = useState(0);
  const [reveal, setReveal] = useState<Answered | null>(null);
  const locked = useRef(false);

  const index = saved.answers.length;
  const done = index >= questions.length;
  const playing = saved.startedAt !== null && !done;
  const untimed = Boolean(saved.untimed);

  const commit = useCallback(
    async (choice: number | null) => {
      if (locked.current || saved.startedAt === null) return;
      locked.current = true;
      const ms = Math.min(untimed ? 10 * 60_000 : LIMIT, Date.now() - saved.startedAt);
      const r = await fetch("/api/five/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, choice, notrack: notTracked() }),
      }).then((r) => r.json());
      const a: Answered = { choice, ms, answer: r.answer };
      setReveal(a);
      setTimeout(() => {
        const answers = [...saved.answers, a];
        if (answers.length === questions.length) track("five:finish");
        save({ answers, startedAt: answers.length < questions.length ? Date.now() : null, untimed });
        setReveal(null);
        setElapsed(0);
        locked.current = false;
      }, 1400);
    },
    [index, questions.length, save, saved, untimed],
  );

  // wall-clock timer, so a refresh doesn't buy extra time
  useEffect(() => {
    if (!playing || reveal || untimed) return;
    let raf = 0;
    const tick = () => {
      const e = Date.now() - (saved.startedAt ?? Date.now());
      setElapsed(e);
      if (e >= LIMIT) commit(null);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reveal, saved.startedAt, commit, untimed]);

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
            <li>
              Rather not race the clock? <b>Play untimed</b>: 100 points per right answer, not ranked.
            </li>
          </ul>
          <div className="stack">
            <button className="cta full" onClick={() => { track("five:start"); save({ answers: [], startedAt: Date.now() }); }}>
              <span>Ring the bell</span>
            </button>
            <button className="cta ghost full" onClick={() => { track("five:start_untimed"); save({ answers: [], startedAt: Date.now(), untimed: true }); }}>
              <span>Play untimed</span>
            </button>
          </div>
        </main>
      </>
    );
  }

  if (done) return <Results day={day} number={number} questions={questions} answers={saved.answers} untimed={untimed} />;

  const q = questions[index];
  const left = Math.min(LIMIT, Math.max(0, LIMIT - elapsed));
  const secsLeft = Math.ceil(left / 1000);
  const shown = reveal;
  const total = saved.answers.reduce((s, a) => s + points(a, untimed), 0);

  return (
    <>
      <Bug>
        {untimed ? <Plate tone="dark">Untimed</Plate> : <Plate tone="clock">0:{String(shown ? 0 : secsLeft).padStart(2, "0")}</Plate>}
      </Bug>
      <main className="wrap">
        <div className="q-top">
          <Plate tone="gold">
            Question {index + 1} / {questions.length}
          </Plate>
          <Plate tone="dark">{total} pts</Plate>
        </div>
        {untimed ? (
          <div className="bar" aria-hidden />
        ) : (
          <div className={`bar${secsLeft <= 3 ? " low" : ""}`} aria-label={`${secsLeft} seconds left`}>
            <i style={{ transform: `scaleX(${shown ? 0 : left / LIMIT})` }} />
          </div>
        )}
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
          {shown && shown.choice === shown.answer && <Plate tone="gold">+{points(shown, untimed)}</Plate>}
          {shown && shown.choice !== null && shown.choice !== shown.answer && <Plate tone="red">Wrong</Plate>}
        </div>
        {!untimed && !shown && secsLeft <= 3 && secsLeft > 0 && (
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

function mark(a: Answered, untimed: boolean): Mark {
  if (a.choice === null) return "X";
  if (a.choice !== a.answer) return "R";
  return untimed || pointsFor(true, a.ms) >= 150 ? "G" : "Y";
}

function Results({ day, number, questions, answers, untimed }: { day: string; number: number; questions: Q[]; answers: Answered[]; untimed: boolean }) {
  const pts = answers.map((a) => points(a, untimed));
  const total = pts.reduce((a, b) => a + b, 0);
  const right = answers.filter((a) => a.choice === a.answer).length;
  const marks = answers.map((a) => mark(a, untimed));
  const max = untimed ? 500 : 1000;
  const share = `THE PUSH · Daily Five No. ${number}${untimed ? " (untimed)" : ""}\n${marks.map((m) => MARK_EMOJI[m]).join("")}  ${total}/${max}`;
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
            Out of {max} · {right} of 5 right{untimed ? " · untimed" : ""}
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
                    {!untimed && ` · ${(a.ms / 1000).toFixed(1)}s`}
                  </small>
                </span>
                <span className="num">{pts[i]}</span>
              </li>
            );
          })}
        </ol>
        <div className="stack">
          <ShareButton game="five" text={share} path={sharePath("five", number, fiveCode(total, marks, untimed))} />
          {untimed ? (
            <p className="muted">Untimed games aren&apos;t ranked. Ring the bell tomorrow to race the clock for the leaderboard.</p>
          ) : (
            <Leaderboard game="five" day={day} payload={{ answers: answers.map(({ choice, ms }) => ({ choice, ms })) }} format={(s) => String(s)} />
          )}
        </div>
        <RemindMe />
        <SignInNudge />
        <NextMatch to="ring" />
      </main>
    </>
  );
}
