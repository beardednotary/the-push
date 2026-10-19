"use client";
// Friend leagues on the client: the league room (/league/CODE), the start form, the
// "Your leagues" list in Your record, and the small link on the results screens.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { notTracked, playerId } from "./client";
import { signInHref } from "@/lib/redirect";
import { ringBoardLabel } from "@/lib/scoring";

function local(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

interface Row {
  rank: number;
  name: string;
  score: number;
  me: boolean;
  leagueChamp: boolean;
  champ: string | null;
  reigns: number;
  tier: string;
  flair: string | null;
  promoter: string | null;
}
interface Belt {
  name: string;
  since: string;
  defenses: number;
  reigns: number;
  me: boolean;
}
interface Room {
  code: string;
  name: string;
  created: string;
  size: number;
  max: number;
  member: boolean;
  owner: boolean;
  roster: { name: string; played: boolean; me: boolean }[];
  standings: { five: Row[]; ring: Row[] };
  belts: { five: Belt | null; ring: Belt | null };
}

const GAMES = [
  { id: "five", title: "Daily Five", href: "/five", format: (s: number) => String(s) },
  { id: "ring", title: "Immaculate Ring", href: "/ring", format: ringBoardLabel },
] as const;

export function LeagueRoom({ code }: { code: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(
    () =>
      fetch(`/api/league/${code}?me=${playerId()}`)
        .then((r) => (r.status === 404 ? null : r.json()))
        .then((d: Room | null) => (d ? setRoom(d) : setMissing(true)))
        .catch(() => {}),
    [code],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (missing)
    return (
      <div className="headline" style={{ marginTop: 40 }}>
        <Plate tone="red">No contest</Plate>
        <h1 className="chrome" style={{ fontSize: "clamp(44px, 11vw, 70px)", marginTop: 14 }}>
          No league here.
        </h1>
        <p className="muted">Check the link with whoever sent it, or start your own.</p>
        <Link className="cta" href="/league/new">
          <span>Start a league</span>
        </Link>
      </div>
    );
  if (!room) return <p className="muted" style={{ marginTop: 40 }}>Loading the card…</p>;

  return (
    <>
      <div className="headline" style={{ marginTop: 34 }}>
        <Plate tone="gold">Friend league · {room.size} {room.size === 1 ? "member" : "members"}</Plate>
        <h1 className="chrome league-name">{room.name}</h1>
      </div>

      {room.member ? <Invite code={room.code} name={room.name} alone={room.size === 1} /> : <JoinDoor room={room} onJoined={load} />}

      <section>
        <div className="section-head">
          <Plate tone="gold">League belts</Plate>
          <Plate tone="dark">Tonight&apos;s #1 takes it</Plate>
        </div>
        <div className="league-belts">
          {GAMES.map((g) => {
            const b = room.belts[g.id];
            return (
              <div key={g.id} className="holder">
                <span className="caps muted">{g.title}</span>
                {b ? (
                  <>
                    <span className="num">{b.name}</span>
                    <span className="muted small">
                      {b.me ? "That's you. " : ""}
                      {b.defenses > 0 ? `${b.defenses} successful defense${b.defenses > 1 ? "s" : ""}` : "New champion"}
                      {b.reigns > 1 ? ` · ${b.reigns}x champ` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="num vacant">Vacant</span>
                    <span className="muted small">Crowned at midnight Eastern</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted small">
          When the night ends, the league&apos;s top score in each game holds that belt. A night nobody plays, it stays put.
        </p>
      </section>

      {GAMES.map((g) => {
        const rows = room.standings[g.id];
        return (
          <section key={g.id}>
            <div className="section-head">
              <Plate tone="gold">{g.title}</Plate>
              <Plate tone="dark">Tonight</Plate>
            </div>
            {rows.length === 0 ? (
              <p className="muted">
                Nobody from the league has posted a score yet. <Link href={g.href} style={{ color: "var(--gold)" }}>Ring the bell</Link>
              </p>
            ) : (
              <ol className="standings">
                {rows.map((r) => (
                  <li key={r.rank} className={r.me ? "me" : ""}>
                    <span className="rk">{r.rank}</span>
                    <span className="nm">
                      {r.leagueChamp && <Plate tone="gold">League Champ</Plate>}
                      {r.champ && <Plate tone="gold">{r.champ.endsWith("weekly") ? "World Champ" : "Champ"}</Plate>}
                      {r.flair && <Plate tone="red">{r.flair}</Plate>}
                      {r.promoter && <Plate tone="dark">{r.promoter}</Plate>} {r.name}
                      {r.reigns > 1 && <span className="reigns"> {r.reigns}x</span>}
                      <small className="tier">{r.tier}</small>
                    </span>
                    <span className="sc">{g.format(r.score)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      <p className="muted small">Scores come from the main standings: post yours there after a game and it shows here too.</p>

      <section>
        <div className="section-head">
          <Plate tone="dark">The roster</Plate>
          <Plate tone="dark">
            {room.size} / {room.max}
          </Plate>
        </div>
        <ul className="roster">
          {room.roster.map((m, i) => (
            <li key={i} className={`${m.played ? "in" : ""} ${m.me ? "me" : ""}`}>
              {m.name}
            </li>
          ))}
        </ul>
        <p className="muted small">Lit up = played tonight.</p>
      </section>
      {room.member && <LeaveLeague room={room} onLeft={load} />}
    </>
  );
}

function LeaveLeague({ room, onLeft }: { room: Room; onLeft: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    await fetch(`/api/league/${room.code}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId() }),
    }).catch(() => {});
    setBusy(false);
    setAsking(false);
    window.dispatchEvent(new Event("push:leagues"));
    onLeft();
  }
  if (!asking)
    return (
      <p className="muted small leave">
        <button className="linkish" onClick={() => setAsking(true)}>
          Leave league
        </button>
      </p>
    );
  return (
    <div className="remind leave-ask">
      <Plate tone="red">Leave {room.name}?</Plate>
      <p>
        Your scores stay on the main standings and any league belt you won stays in its history.
        {room.owner && room.size > 1 ? " You started this league, so it passes to whoever's been in it longest." : ""} You can
        rejoin with the invite link.
      </p>
      <div className="leave-row">
        <button className="cta" onClick={leave} disabled={busy}>
          <span>Leave</span>
        </button>
        <button className="cta ghost" onClick={() => setAsking(false)}>
          <span>Stay</span>
        </button>
      </div>
    </div>
  );
}

function JoinDoor({ room, onJoined }: { room: Room; onJoined: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(local("push:name")), []);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (name.trim()) localStorage.setItem("push:name", name.trim());
    } catch {}
    const r = await fetch(`/api/league/${room.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId(), name, track: !notTracked() }),
    })
      .then((r) => r.json())
      .catch(() => ({ error: "Couldn't reach the ring. Try again." }));
    setBusy(false);
    if (r.error) return setError(r.error);
    window.dispatchEvent(new Event("push:leagues"));
    onJoined();
  }
  return (
    <div className="remind join">
      <Plate tone="red">You&apos;re invited</Plate>
      <p>
        <b>Join {room.name}</b> and your nightly Daily Five and Immaculate Ring scores land on this board, with a belt on the
        line every night. No account needed.
      </p>
      {room.size >= room.max ? (
        <p className="miss">This league is full.</p>
      ) : (
        <form onSubmit={join} className="post">
          <input className="field" placeholder="Your ring name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} required />
          <button className="cta" disabled={busy}>
            <span>Join the league</span>
          </button>
        </form>
      )}
      {error && <p className="miss">{error}</p>}
    </div>
  );
}

/** Copy (or share) the invite. The link carries the sharer's ?by= code, so a friend who
 *  joins and finishes their first game makes the sharer a Promoter. */
function Invite({ code, name, alone }: { code: string; name: string; alone: boolean }) {
  const [by, setBy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/ref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: playerId() }) })
      .then((r) => r.json())
      .then((d) => setBy(d.code ?? null))
      .catch(() => {});
  }, []);
  async function share() {
    const url = `${location.origin}/league/${code}${by ? `?by=${by}` : ""}`;
    const text = `Join my league on The Push: ${name}. Nightly wrestling trivia, our own standings, and a belt on the line.`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }
  return (
    <div className="challenge">
      <button className="cta gold full" onClick={share}>
        <span>{copied ? "Copied. Paste it in the group chat" : "Copy invite link"}</span>
      </button>
      <p className="muted small">{alone ? "It's just you so far. Send the link to the group chat." : "Anyone with the link can join, up to 50."}</p>
    </div>
  );
}

export function StartLeague() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [needSignIn, setNeedSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId(), name, ringName: local("push:name"), track: !notTracked() }),
    })
      .then((r) => r.json())
      .catch(() => ({ error: "Couldn't reach the ring. Try again." }));
    setBusy(false);
    if (r.code) {
      window.dispatchEvent(new Event("push:leagues"));
      return router.push(`/league/${r.code}`);
    }
    setError(r.error ?? "Something went wrong.");
    setNeedSignIn(Boolean(r.signIn));
  }
  return (
    <form onSubmit={create}>
      <div className="post">
        <input className="field" placeholder="League name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} required />
        <button className="cta" disabled={busy}>
          <span>Start it</span>
        </button>
      </div>
      {error && (
        <p className="miss">
          {error}{" "}
          {needSignIn && (
            <Link href={signInHref("/league/new")} style={{ color: "var(--gold)" }}>
              Sign in
            </Link>
          )}
        </p>
      )}
    </form>
  );
}

/** "Your leagues" inside Your record. */
export function YourLeagues() {
  const [leagues, setLeagues] = useState<{ code: string; name: string; size: number; owner: boolean }[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch(`/api/league?id=${playerId()}`)
        .then((r) => r.json())
        .then((d) => setLeagues(d.leagues ?? []))
        .catch(() => {});
    load();
    window.addEventListener("push:leagues", load);
    return () => window.removeEventListener("push:leagues", load);
  }, []);
  if (!leagues) return null;
  if (!leagues.length)
    return (
      <p className="muted small">
        Play your friends every night: <Link href="/league/new" style={{ color: "var(--gold)" }}>start a league</Link> with its own
        standings and belt.
      </p>
    );
  return (
    <>
      <div className="section-head" style={{ marginTop: 16 }}>
        <Plate tone="dark">Your leagues</Plate>
      </div>
      <ul className="honors leagues">
        {leagues.map((l) => (
          <li key={l.code}>
            <Link href={`/league/${l.code}`}>
              <span>{l.name}</span>
              <small>
                {l.size} {l.size === 1 ? "member" : "members"}
                {l.owner ? " · yours" : ""}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The small link under Challenge a friend on the results screens. */
export function LeagueLink() {
  return (
    <p className="muted small league-link">
      Same friends every night? <Link href="/league/new">Start a league with friends</Link>
    </p>
  );
}
