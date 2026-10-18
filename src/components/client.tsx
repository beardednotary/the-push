"use client";
// Shared client bits: who's playing, today's saved progress, sharing, leaderboard, cross-promo.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import type { Region } from "@/lib/regions";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function playerId(): string {
  let id = safeGet("push:player");
  if (!id) {
    id = crypto.randomUUID();
    safeSet("push:player", id);
  }
  return id;
}

export function useSaved<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const raw = safeGet(key);
    if (raw) {
      try {
        setValue(JSON.parse(raw));
      } catch {}
    }
    setLoaded(true);
  }, [key]);
  const save = (v: T) => {
    setValue(v);
    safeSet(key, JSON.stringify(v));
  };
  return [value, save, loaded];
}

/** Your own devices: visit any page with ?notrack once and they stop counting (?track undoes it). */
export function notTracked(): boolean {
  return safeGet("push:notrack") === "1";
}

/** Bump an anonymous daily counter (games started, finished, shared). Finishes also
 *  count toward the player's streak and rank, even on ?notrack devices. */
export function track(event: string) {
  if (event.endsWith(":finish")) {
    fetch("/api/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: playerId() }), keepalive: true })
      .then(() => window.dispatchEvent(new Event("push:career")))
      .catch(() => {});
  }
  if (notTracked()) return;
  const body = event.endsWith(":finish") ? { event, playerId: playerId() } : { event };
  fetch("/api/stat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

/** The post-game challenge: sends the result plus a link whose preview is the player's score card. */
export function ShareButton({ text, path, game, teaser, dare }: { text: string; path: string; game: "five" | "ring" | `ring${Region}`; teaser: string; dare: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    track(`${game}:share_tap`); // intent, even if they close the share sheet
    const streak = Number(safeGet("push:streak") ?? 0);
    // result, then the streak, then the dare
    const body = `${text}${streak >= 2 ? `\n🔥 ${streak}-day streak` : ""}\n${dare}`;
    const url = `${location.origin}${path}`;
    if (navigator.share) {
      try {
        // url as its own field so messaging apps build the score-card preview
        await navigator.share({ text: body, url });
        track(`${game}:share`);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // closed the share sheet
      }
    }
    await navigator.clipboard.writeText(`${body}\n${url}`);
    track(`${game}:share`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }
  return (
    <div className="challenge">
      <button className="cta gold full" onClick={share}>
        <span>{copied ? "Copied. Paste it anywhere" : "Challenge a friend"}</span>
      </button>
      <p className="muted small">{teaser}</p>
    </div>
  );
}

interface Row {
  rank: number;
  name: string;
  score: number;
  me: boolean;
  champ?: string | null; // belt id currently held in this game
  reigns?: number;
  tier?: string;
  flair?: string | null; // hand-given, e.g. Road Agent
}

export function Leaderboard({ game, region, day, payload, format }: { game: "five" | "ring"; region?: string; day: string; payload: object; format: (score: number) => string }) {
  const board = region ? `${game}:${region}` : game;
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [standing, setStanding] = useState<{ rank: number; of: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setName(safeGet("push:name") ?? "");
    setSubmitted(safeGet(`push:${board}:submitted`) === day);
    fetch(`/api/leaderboard/${game}?me=${playerId()}${region ? `&region=${region}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRows(d.top));
  }, [game, region, board, day]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    safeSet("push:name", name);
    const r = await fetch(`/api/leaderboard/${game}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId(), name, ...payload }),
    }).then((r) => r.json());
    setRows(r.top);
    setStanding(r.standing);
    setSubmitted(true);
    safeSet(`push:${board}:submitted`, day);
  }

  return (
    <section>
      <div className="section-head">
        <Plate tone="gold">Standings</Plate>
        <Plate tone="dark">Tonight</Plate>
      </div>
      {!submitted && (
        <form onSubmit={submit} className="post">
          <input className="field" placeholder="Your ring name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} required />
          <button className="cta ghost">
            <span>Post score</span>
          </button>
        </form>
      )}
      {standing && (
        <p className="muted">
          You&apos;re #{standing.rank} of {standing.of} today.
        </p>
      )}
      {rows && rows.length === 0 && <p className="muted">Nobody on the board yet. Be first.</p>}
      <p className="muted small">
        {region ? (
          <>This board is just for bragging rights: no belt is on the line.</>
        ) : (
          <>
            Tonight&apos;s #1 signed-in player takes the belt at midnight Eastern. <Link href="/titles" style={{ color: "var(--gold)" }}>Title history</Link>
          </>
        )}
      </p>
      {rows && rows.length > 0 && (
        <ol className="standings">
          {rows.map((r) => (
            <li key={r.rank} className={r.me ? "me" : ""}>
              <span className="rk">{r.rank}</span>
              <span className="nm">
                {r.champ && <Plate tone="gold">{r.champ.endsWith("weekly") ? "World Champ" : "Champ"}</Plate>}
                {r.flair && <Plate tone="red">{r.flair}</Plate>} {r.name}
                {(r.reigns ?? 0) > 1 && <span className="reigns"> {r.reigns}x</span>}
                {r.tier && <small className="tier">{r.tier}</small>}
              </span>
              <span className="sc">{format(r.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function NextMatch({ to }: { to: "five" | "ring" }) {
  const copy =
    to === "ring"
      ? { slot: "Main event", title: "Immaculate Ring", body: "Nine squares, nine guesses. Name a wrestler who fits both sides." }
      : { slot: "Opening contest", title: "Daily Five", body: "Five questions, fifteen seconds each. Fast and right scores big." };
  return (
    <div className="upnext">
      <Plate tone="gold">Up next · {copy.slot}</Plate>
      <h2 className="chrome">{copy.title}</h2>
      <p>{copy.body}</p>
      <Link className="cta" href={`/${to}`}>
        <span>Ring the bell</span>
      </Link>
    </div>
  );
}
