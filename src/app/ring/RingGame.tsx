"use client";
import { useEffect, useRef, useState } from "react";
import { Leaderboard, NextMatch, ShareButton, useSaved } from "@/components/client";
import { Bug, Plate } from "@/components/Chrome";
import { ringBoardLabel } from "@/lib/scoring";
import { ringCode, sharePath } from "@/lib/share";

interface Side {
  id: string;
  label: string;
  detail: string;
}
interface Filled {
  id: number;
  name: string;
  rarity: number;
}
interface Saved {
  cells: (Filled | null)[];
  guesses: number;
  done: boolean;
}
interface Hit {
  id: number;
  name: string;
  aka?: string;
}

const START: Saved = { cells: Array(9).fill(null), guesses: 9, done: false };

export default function RingGame({ day, number, rows, cols }: { day: string; number: number; rows: Side[]; cols: Side[] }) {
  const [saved, save, loaded] = useSaved<Saved>(`push:ring:${day}`, START);
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState<Side | null>(null);

  if (!loaded) return <Bug />;
  const filled = saved.cells.filter(Boolean).length;
  const over = saved.done || saved.guesses <= 0 || filled === 9;

  function record(cell: number, hit: Filled | null) {
    const cells = saved.cells.slice();
    if (hit) cells[cell] = hit;
    const guesses = saved.guesses - 1;
    const next = { cells, guesses, done: guesses <= 0 || cells.every(Boolean) };
    save(next);
    if (hit || next.done) setOpen(null);
  }

  return (
    <>
    <Bug>
      <Plate tone="dark">Ring · No. {number}</Plate>
    </Bug>
    <main className="wrap">
      <div className="ring">
        <div className="corner">
          <span className="num">{saved.guesses}</span>
          <span className="caps">guesses</span>
        </div>
        {cols.map((c) => (
          <button key={c.id} className="pad col" aria-pressed={focus?.id === c.id} onClick={() => setFocus(focus?.id === c.id ? null : c)}>
            {c.label}
          </button>
        ))}
        {rows.map((r, ri) => (
          <Row key={r.id}>
            <button className="pad row" aria-pressed={focus?.id === r.id} onClick={() => setFocus(focus?.id === r.id ? null : r)}>
              {r.label}
            </button>
            {cols.map((_c, ci) => {
              const i = ri * 3 + ci;
              const f = saved.cells[i];
              return (
                <button
                  key={i}
                  className={`cell${f ? " filled" : ""}`}
                  disabled={!!f || over}
                  onClick={() => setOpen(i)}
                  aria-label={f ? f.name : `${r.label} and ${cols[ci].label}`}
                >
                  {f ? (
                    <span>
                      {f.name}
                      <span className="rar">{f.rarity}%</span>
                    </span>
                  ) : (
                    ""
                  )}
                </button>
              );
            })}
          </Row>
        ))}
      </div>
      <p className="detail">
        {focus ? (
          <>
            <b>{focus.label}:</b> {focus.detail}
          </>
        ) : over ? (
          ""
        ) : (
          "Tap a square to name a wrestler who fits its row and column. Tap a pad to read its rule."
        )}
      </p>

      {!over && (
        <button className="cta ghost full" onClick={() => save({ ...saved, done: true })}>
          <span>Tap out</span>
        </button>
      )}

      {over && <Results day={day} number={number} cells={saved.cells} />}

      {open !== null && !over && (
        <Picker
          title={[rows[Math.floor(open / 3)].label, cols[open % 3].label]}
          used={saved.cells.filter((c): c is Filled => !!c).map((c) => c.id)}
          guesses={saved.guesses}
          onClose={() => setOpen(null)}
          onGuess={async (hit) => {
            const r = await fetch("/api/ring/guess", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cell: open, wrestlerId: hit.id }),
            }).then((r) => r.json());
            record(open, r.correct ? { id: hit.id, name: r.name, rarity: r.rarity } : null);
            return r.correct as boolean;
          }}
        />
      )}
    </main>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Picker({
  title,
  used,
  guesses,
  onClose,
  onGuess,
}: {
  title: [string, string];
  used: number[];
  guesses: number;
  onClose: () => void;
  onGuess: (hit: Hit) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [miss, setMiss] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/ring/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then(setHits);
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h3>
          {title[0]} <em>×</em> {title[1]}
        </h3>
        <input
          ref={input}
          className="search"
          placeholder="Search wrestlers"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMiss("");
          }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className="miss" aria-live="polite">
          {miss}
        </div>
        <ul className="results">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                disabled={busy || used.includes(h.id)}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onGuess(h);
                  setBusy(false);
                  if (!ok) setMiss(`${h.name} doesn't fit. ${guesses - 1} guesses left.`);
                }}
              >
                {h.name}
                {h.aka && <small>aka {h.aka}</small>}
                {used.includes(h.id) && <small>already used</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Results({ day, number, cells }: { day: string; number: number; cells: (Filled | null)[] }) {
  const squares = cells.filter(Boolean).length;
  const rarity = cells.reduce((s, c) => s + (c ? c.rarity : 100), 0);
  const grid = [0, 1, 2].map((r) => cells.slice(r * 3, r * 3 + 3).map((c) => (c ? "🟩" : "⬜")).join("")).join("\n");
  const share = `THE PUSH · Immaculate Ring No. ${number}\n${grid}\n${squares}/9 · Rarity ${rarity}`;
  return (
    <section>
      <div className="final">
        <Plate tone="gold">Immaculate Ring · Final</Plate>
        <div className="num score">{squares}/9</div>
        <div className="sub">Rarity {rarity} · lower is rarer</div>
      </div>
      <div className="stack">
        <ShareButton text={share} path={sharePath("ring", number, ringCode(rarity, cells.map(Boolean)))} />
        <Leaderboard game="ring" day={day} payload={{ cells: cells.map((c) => c?.id ?? null) }} format={ringBoardLabel} />
      </div>
      <NextMatch to="five" />
    </section>
  );
}
