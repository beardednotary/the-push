// The post-show: a past card's answers. Shared by /yesterday and the archive pages.
import Link from "next/link";
import { Fragment } from "react";
import type { Question } from "@/lib/five";
import { pairHref } from "@/lib/grid";
import type { CellPicks } from "@/lib/picks";
import type { Grid } from "@/lib/ring";

const KEYS = ["A", "B", "C", "D"];

/** The Daily Five with its answers, and how the room voted while the counts last. */
export function FiveAnswers({ questions, stats }: { questions: Question[]; stats: Record<string, number> }) {
  return (
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
              <p className="muted small">Answer: {q.options[q.answer]}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The 3x3 with its category plates, each square showing its most-picked (or a well-known) answer. */
export function RingBoard({ grid, picks }: { grid: Grid; picks: CellPicks[] }) {
  return (
    <div className="ring picked">
      <div className="corner" />
      {grid.cols.map((c) => (
        <div key={c.id} className="pad col">
          {c.label}
        </div>
      ))}
      {grid.rows.map((r, ri) => (
        <Fragment key={r.id}>
          <div className="pad row">{r.label}</div>
          {grid.cols.map((_c, ci) => {
            const p = picks[ri * 3 + ci];
            const best = p.top[0];
            return (
              <div key={ci} className="cell picked-cell">
                {best ? (
                  <span>
                    {best.name}
                    <span className="rar">{best.pct}%</span>
                  </span>
                ) : (
                  <span>{p.examples[0] ?? "—"}</span>
                )}
                <small className="possible">{p.possible} possible</small>
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Square by square: the most-picked names and other right answers. */
export function RingKey({ grid, picks }: { grid: Grid; picks: CellPicks[] }) {
  return (
    <div className="keylist">
      {grid.rows.flatMap((r, ri) =>
        grid.cols.map((c, ci) => {
          const p = picks[ri * 3 + ci];
          const topNames = new Set(p.top.map((t) => t.name));
          const more = p.examples.filter((n) => !topNames.has(n)).slice(0, p.top.length ? 4 : 6);
          return (
            <div key={`${ri}-${ci}`} className="key">
              <h3 className="caps">
                <span className="r">{r.label}</span> × <span className="c">{c.label}</span>
              </h3>
              {p.top.length > 0 && (
                <p>
                  <b>Most picked:</b> {p.top.map((t) => `${t.name} (${t.pct}%)`).join(", ")}
                </p>
              )}
              {more.length > 0 && (
                <p className={p.top.length ? "muted" : undefined}>
                  <b>{p.top.length ? "Also right" : "Right answers"}:</b> {more.join(", ")}
                </p>
              )}
              <p className="muted small">
                {p.possible} wrestlers would have counted.{" "}
                <Link className="gold" href={pairHref(r, c)}>
                  See them all
                </Link>
              </p>
            </div>
          );
        }),
      )}
    </div>
  );
}

/** Older / archive / newer, between a game's answer pages. `last` is the newest past card. */
export function DayNav({ game, n, last, first = 1 }: { game: "ring" | "five" | "wordle"; n: number; last: number; first?: number }) {
  return (
    <nav className="daynav" aria-label="More cards">
      {n > first ? <Link href={`/${game}/answers/${n - 1}`}>← No. {n - 1}</Link> : <span />}
      <Link href="/archive">Every card</Link>
      {n < last ? <Link href={`/${game}/answers/${n + 1}`}>No. {n + 1} →</Link> : <Link href={`/${game}`}>Tonight →</Link>}
    </nav>
  );
}
