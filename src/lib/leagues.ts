// Friend leagues: a private group with its own nightly standings and its own belt.
// A signed-in player starts one and shares the invite link (/league/CODE); anyone who
// opens it can join with their player ID. Standings are the main daily boards
// (lb:five:DAY, lb:ring:DAY) filtered to members. Each night's #1 member in each game
// holds the league belt, crowned lazily like the real titles (see titles.ts), but
// anyone in the league is eligible: no sign-in needed, and admins can win.
import { randomBytes } from "node:crypto";
import { addDays, todayKey } from "./day";
import { store } from "./store";
import type { Game } from "./titles";

export const MAX_MEMBERS = 50;
export const MAX_LEAGUES = 10;
export const LEAGUE_GAMES: Game[] = ["five", "ring"];

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
const k = {
  league: (code: string) => `league:${code}`,
  members: (code: string) => `league:${code}:members`,
  mine: (playerId: string) => `player:${playerId}:leagues`,
  crowned: (code: string) => `league:${code}:crown`, // game -> last day crowned
  lineage: (code: string, game: Game) => `league:${code}:lineage:${game}`,
};

export interface League {
  code: string;
  name: string;
  owner: string;
  created: string; // day the league started
}

export const cleanCode = (raw: unknown) => (new RegExp(`^[${ALPHABET}]{6}$`).test(String(raw ?? "")) ? String(raw) : null);

export function cleanLeagueName(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/[^\p{L}\p{N} ._'&!?#-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 30);
  return s || null;
}

export async function getLeague(code: string): Promise<League | null> {
  const h = await store.hashGet(k.league(code));
  return h.name ? { code, name: h.name, owner: h.owner, created: h.created } : null;
}

export const members = (code: string) => store.setMembers(k.members(code));
export const isMember = (code: string, playerId: string) => store.setHas(k.members(code), playerId);

export type JoinResult = "joined" | "already" | "full" | "too-many" | "missing";

/** A player's leagues, newest first. */
export async function leaguesOf(playerId: string): Promise<(League & { size: number })[]> {
  const codes = await store.setMembers(k.mine(playerId));
  const all = await Promise.all(
    codes.map(async (code) => {
      const [l, m] = await Promise.all([getLeague(code), members(code)]);
      return l ? { ...l, size: m.length } : null;
    }),
  );
  return all.filter((l) => l !== null).sort((a, b) => b.created.localeCompare(a.created) || a.name.localeCompare(b.name));
}

export async function joinLeague(code: string, playerId: string): Promise<JoinResult> {
  if (!(await getLeague(code))) return "missing";
  if (await isMember(code, playerId)) return "already";
  if ((await members(code)).length >= MAX_MEMBERS) return "full";
  if ((await store.setMembers(k.mine(playerId))).length >= MAX_LEAGUES) return "too-many";
  await store.setAdd(k.members(code), playerId);
  await store.setAdd(k.mine(playerId), code);
  return "joined";
}

/** Start a league owned by `owner`, who joins it. null if they're already in the maximum. */
export async function createLeague(owner: string, name: string): Promise<string | null> {
  if ((await store.setMembers(k.mine(owner))).length >= MAX_LEAGUES) return null;
  for (let tries = 0; tries < 8; tries++) {
    const code = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
    if (!(await store.setOnce(`league-code:${code}`, owner)) || (await getLeague(code))) continue;
    await store.hashSet(k.league(code), { name, owner, created: todayKey() });
    await joinLeague(code, owner);
    return code;
  }
  throw new Error("no free league code");
}

/** One night's league standings: the main board, members only. */
export async function leagueBoard(code: string, game: Game, day: string, memberIds?: string[]) {
  const ids = new Set(memberIds ?? (await members(code)));
  return (await store.all(`lb:${game}:${day}`)).filter((e) => ids.has(e.member));
}

export interface LeagueResult {
  day: string;
  playerId: string;
  name: string;
  score: number;
}

/** Crown every finished night since the league started. A night no member played is no
 *  contest: the belt stays where it is. Safe to call on every request. */
export async function ensureLeagueCrowned(code: string, created: string, today = todayKey()) {
  const pointers = await store.hashGet(k.crowned(code));
  let ids: string[] | null = null;
  for (const game of LEAGUE_GAMES) {
    let day = pointers[game] ? addDays(pointers[game], 1) : created;
    while (day < today) {
      if (await store.setOnce(`league:${code}:crowned:${game}:${day}`, "1")) {
        ids ??= await members(code);
        const best = (await leagueBoard(code, game, day, ids))[0];
        if (best) {
          const names = await store.names([best.member]);
          const r: LeagueResult = { day, playerId: best.member, name: names[best.member] ?? "Anonymous", score: best.score };
          await store.listPush(k.lineage(code, game), JSON.stringify(r));
        }
      }
      await store.hashSet(k.crowned(code), { [game]: day });
      day = addDays(day, 1);
    }
  }
}

export interface LeagueChamp {
  playerId: string;
  name: string;
  since: string; // first night of this reign
  defenses: number;
  reigns: number; // this player's reigns with this league's belt
}

/** The current holder of a league's belt in one game, or null before anyone's won it. */
export async function leagueChamp(code: string, game: Game): Promise<LeagueChamp | null> {
  const rs = (await store.list(k.lineage(code, game))).map((v) => JSON.parse(v) as LeagueResult).sort((a, b) => a.day.localeCompare(b.day));
  if (!rs.length) return null;
  const last = rs[rs.length - 1];
  let reigns = 0;
  rs.forEach((r, i) => {
    if (r.playerId === last.playerId && rs[i - 1]?.playerId !== r.playerId) reigns++;
  });
  let i = rs.length - 1;
  while (i > 0 && rs[i - 1].playerId === last.playerId) i--;
  return { playerId: last.playerId, name: last.name, since: rs[i].day, defenses: rs.length - 1 - i, reigns };
}
