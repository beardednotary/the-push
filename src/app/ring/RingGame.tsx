"use client";
import { useEffect, useRef, useState } from "react";
import { Leaderboard, NextMatch, ShareButton, playerId, track, useSaved } from "@/components/client";
import { Bug, Plate } from "@/components/Chrome";
import { Poll } from "@/components/Poll";
import { RemindMe } from "@/components/RemindMe";
import { SignInNudge } from "@/components/account";
import { YourRecord } from "@/components/record";
import { LeagueLink } from "@/components/league";
import { FinishMoment } from "@/components/FinishMoment";
import { ringBoardLabel } from "@/lib/scoring";
import { ringCode, sharePath } from "@/lib/share";
import { REGIONS, type Region } from "@/lib/regions";
import { Feeds } from "./Feeds";

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

export default function RingGame({ day, number, rows, cols, region }: { day: string; number: number; rows: Side[]; cols: Side[]; region?: Region }) {
  const [saved, save, loaded] = useSaved<Saved>(region ? `push:ring:${region}:${day}` : `push:ring:${day}`, START);
  const stat = region ? `ring${region}` : "ring";
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
    if (saved.guesses === 9) track(`${stat}:start`);
    if (next.done) track(`${stat}:finish`);
    save(next);
    if (hit || next.done) setOpen(null);
  }

  return (
    <>
    <Bug>
      <Plate tone="dark">Ring{region ? ` · ${REGIONS[region].name}` : ""} · No. {number}</Plate>
    </Bug>
    <main className="wrap">
      <Feeds region={region} />
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
      {!over && (
        <>
          <p className="detail">Tap a square and name a wrestler who fits both its row and its column.</p>
          <ul className="rulebook" aria-label="Today's rules">
            {[...rows.map((r) => ({ ...r, kind: "row" })), ...cols.map((c) => ({ ...c, kind: "col" }))].map((c) => (
              <li key={c.id} className={`${c.kind}${focus?.id === c.id ? " on" : ""}`}>
                <b>{c.label}:</b> {c.detail}
              </li>
            ))}
          </ul>
        </>
      )}

      {!over && (
        <button className="cta ghost full" onClick={() => { track(`${stat}:finish`); save({ ...saved, done: true }); }}>
          <span>Tap out</span>
        </button>
      )}

      {over && <Results day={day} number={number} cells={saved.cells} rows={rows} cols={cols} region={region} />}

      {open !== null && !over && (
        <Picker
          sides={[rows[Math.floor(open / 3)], cols[open % 3]]}
          used={saved.cells.filter((c): c is Filled => !!c).map((c) => c.id)}
          guesses={saved.guesses}
          onClose={() => setOpen(null)}
          onGuess={async (hit) => {
            const r = await fetch("/api/ring/guess", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cell: open, wrestlerId: hit.id, region }),
            }).then((r) => r.json());
            record(open, r.correct ? { id: hit.id, name: r.name, rarity: r.rarity } : null);
            return r.correct as boolean;
          }}
          onDispute={(hit) =>
            fetch("/api/ring/dispute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ day, cell: open, wrestlerId: hit.id, region, playerId: playerId() }),
            }).catch(() => {})
          }
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
  sides,
  used,
  guesses,
  onClose,
  onGuess,
  onDispute,
}: {
  sides: [Side, Side];
  used: number[];
  guesses: number;
  onClose: () => void;
  onGuess: (hit: Hit) => Promise<boolean>;
  onDispute: (hit: Hit) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [miss, setMiss] = useState("");
  const [missed, setMissed] = useState<Hit | null>(null); // the rejected pick, for "tell us"
  const [told, setTold] = useState(false);
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
          {sides[0].label} <em>×</em> {sides[1].label}
        </h3>
        <ul className="rulebook tight">
          <li className="row">
            <b>{sides[0].label}:</b> {sides[0].detail}
          </li>
          <li className="col">
            <b>{sides[1].label}:</b> {sides[1].detail}
          </li>
        </ul>
        <input
          ref={input}
          className="search"
          placeholder="Search wrestlers"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMiss("");
            setMissed(null);
          }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className="miss" aria-live="polite">
          {miss}
        </div>
        {missed && (
          <p className="dispute">
            {told ? (
              "Thanks. We'll check it."
            ) : (
              <button
                onClick={() => {
                  onDispute(missed);
                  setTold(true);
                }}
              >
                Think that&apos;s wrong? Tell us.
              </button>
            )}
          </p>
        )}
        <ul className="results">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                disabled={busy || used.includes(h.id)}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onGuess(h);
                  setBusy(false);
                  if (!ok) {
                    setMiss(`${h.name} doesn't fit. ${guesses - 1} guesses left.`);
                    setMissed(h);
                    setTold(false);
                  }
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

function Results({ day, number, cells, rows, cols, region }: { day: string; number: number; cells: (Filled | null)[]; rows: Side[]; cols: Side[]; region?: Region }) {
  const squares = cells.filter(Boolean).length;
  const rarity = cells.reduce((s, c) => s + (c ? c.rarity : 100), 0);
  const grid = [0, 1, 2].map((r) => cells.slice(r * 3, r * 3 + 3).map((c) => (c ? "🟩" : "⬜")).join("")).join("\n");
  // brag about the rarest pick without naming it (a name would give away an answer)
  const rarest = Math.min(...cells.filter((c): c is Filled => !!c).map((c) => c.rarity));
  const brag = squares > 0 && rarest <= 20 ? `\nRarest pick: ${rarest}% 👀` : "";
  const title = region ? `Immaculate Ring ${REGIONS[region].name}` : "Immaculate Ring";
  const share = `THE PUSH · ${title} No. ${number}\n${grid}\n${squares}/9 · Rarity ${rarity}${brag}`;
  const shareProps = {
    game: region ? (`ring${region}` as const) : ("ring" as const),
    text: share,
    // the score-card preview only knows the main Ring, so region results link to the grid itself
    path: region ? `/ring/${REGIONS[region].slug}` : sharePath("ring", number, ringCode(rarity, cells.map(Boolean))),
    teaser: `Sends your grid (no names, no spoilers) and a link to tonight's ${title}.`,
    dare: "Can you fill the grid?",
  };
  return (
    <section>
      <div className="final">
        <Plate tone="gold">{title} · Final</Plate>
        <div className="num score">{squares}/9</div>
        <div className="sub">Rarity {rarity} · lower is rarer</div>
      </div>
      <ShareButton {...shareProps} />
      {!region && <LeagueLink />}
      <FinishMoment
        storageKey={`push:moment:ring${region ?? ""}:${day}`}
        label={`${title} · No. ${number}`}
        score={squares}
        of={9}
        sub={squares === 9 ? `Immaculate · Rarity ${rarity}` : `Rarity ${rarity} · lower is rarer`}
        share={shareProps}
      />
      <YourRecord />
      <div className="stack">
        <Leaderboard game="ring" region={region} day={day} payload={{ cells: cells.map((c) => c?.id ?? null), region }} format={ringBoardLabel} />
      </div>
      <MostPicked rows={rows} cols={cols} mine={cells} region={region} />
      <Poll />
      <RemindMe />
      <SignInNudge />
      <NextMatch to="five" />
    </section>
  );
}

interface Picks {
  total: number;
  top: { name: string; pct: number }[];
  possible: number;
}

/** What everyone else put in each square, with your own picks marked. */
function MostPicked({ rows, cols, mine, region }: { rows: Side[]; cols: Side[]; mine: (Filled | null)[]; region?: Region }) {
  const [picks, setPicks] = useState<Picks[] | null>(null);
  useEffect(() => {
    fetch(region ? `/api/ring/picks?region=${region}` : "/api/ring/picks")
      .then((r) => r.json())
      .then(setPicks)
      .catch(() => {});
  }, [region]);
  if (!picks) return null;
  return (
    <section>
      <div className="section-head">
        <Plate tone="gold">Most picked</Plate>
        <Plate tone="dark">Tonight</Plate>
      </div>
      <div className="ring picked">
        <div className="corner" />
        {cols.map((c) => (
          <div key={c.id} className="pad col">
            {c.label}
          </div>
        ))}
        {rows.map((r, ri) => (
          <Row key={r.id}>
            <div className="pad row">{r.label}</div>
            {cols.map((_c, ci) => {
              const i = ri * 3 + ci;
              const p = picks[i];
              const best = p?.top[0];
              return (
                <div key={i} className="cell picked-cell">
                  {best ? (
                    <span>
                      {best.name}
                      <span className="rar">{best.pct}%</span>
                    </span>
                  ) : (
                    <span className="muted">No picks yet</span>
                  )}
                  {mine[i] && mine[i]!.name !== best?.name && <small className="mine">You: {mine[i]!.name}</small>}
                  <small className="possible">{p?.possible ?? 0} possible</small>
                </div>
              );
            })}
          </Row>
        ))}
      </div>
      {!region && (
        <p className="muted" style={{ fontSize: 15 }}>
          Full answer key for every square posts tomorrow on <a href="/yesterday" style={{ color: "var(--gold)" }}>Yesterday&apos;s card</a>.
        </p>
      )}
    </section>
  );
}
