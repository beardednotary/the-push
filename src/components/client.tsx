"use client";
// Shared client bits: who's playing, today's saved progress, sharing, leaderboard, cross-promo.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";

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

/** Bump an anonymous daily counter (games started, finished, shared). */
export function track(event: string) {
  if (notTracked()) return;
  fetch("/api/stat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }), keepalive: true }).catch(() => {});
}

export function ShareButton({ text, path, game }: { text: string; path: string; game: "five" | "ring" }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    track(`${game}:share`);
    const full = `${text}\n${location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: full });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button className="cta full" onClick={share}>
      <span>{copied ? "Copied to clipboard" : "Share your card"}</span>
    </button>
  );
}

interface Row {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}

export function Leaderboard({ game, day, payload, format }: { game: "five" | "ring"; day: string; payload: object; format: (score: number) => string }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [standing, setStanding] = useState<{ rank: number; of: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setName(safeGet("push:name") ?? "");
    setSubmitted(safeGet(`push:${game}:submitted`) === day);
    fetch(`/api/leaderboard/${game}?me=${playerId()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.top));
  }, [game, day]);

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
    safeSet(`push:${game}:submitted`, day);
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
      {rows && rows.length > 0 && (
        <ol className="standings">
          {rows.map((r) => (
            <li key={r.rank} className={r.me ? "me" : ""}>
              <span className="rk">{r.rank}</span>
              <span className="nm">{r.name}</span>
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
