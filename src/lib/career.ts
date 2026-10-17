// A player's career: games finished, the Iron Man streak (consecutive days played)
// and a rank earned by showing up. Keyed by the anonymous player ID, which follows
// a signed-in account across devices.
import { addDays, todayKey } from "./day";
import { store } from "./store";

export const RANKS: [number, string][] = [
  [150, "Hall of Famer"],
  [75, "Main Eventer"],
  [35, "Upper Mid-Card"],
  [15, "Mid-Carder"],
  [5, "Enhancement Talent"],
  [0, "Jobber"],
];

export function rankFor(games: number) {
  return RANKS.find(([min]) => games >= min)![1];
}

export function nextRank(games: number): { name: string; at: number } | null {
  const next = [...RANKS].reverse().find(([min]) => games < min);
  return next ? { name: next[1], at: next[0] } : null;
}

export interface Career {
  games: number;
  streak: number; // current Iron Man streak, 0 once a day is missed
  best: number;
  last: string; // last day a game was finished
  rank: string;
}

const key = (playerId: string) => `player:${playerId}`;

function read(rec: Record<string, string>, today = todayKey()): Career {
  const games = Number(rec.games ?? 0);
  const last = rec.last ?? "";
  const alive = last === today || last === addDays(today, -1);
  return { games, streak: alive ? Number(rec.streak ?? 0) : 0, best: Number(rec.best ?? 0), last, rank: rankFor(games) };
}

export async function career(playerId: string): Promise<Career> {
  return read(await store.hashGet(key(playerId)));
}

export async function careers(playerIds: string[]): Promise<Record<string, Career>> {
  const recs = await Promise.all(playerIds.map((id) => store.hashGet(key(id))));
  return Object.fromEntries(playerIds.map((id, i) => [id, read(recs[i])]));
}

/** Count a finished game; the streak grows once per new day in a row. */
export async function recordFinish(playerId: string, day = todayKey()): Promise<Career> {
  const rec = await store.hashGet(key(playerId));
  await store.hashBump(key(playerId), "games");
  if (rec.last !== day) {
    const streak = rec.last === addDays(day, -1) ? Number(rec.streak ?? 0) + 1 : 1;
    await store.hashSet(key(playerId), { last: day, streak, best: Math.max(streak, Number(rec.best ?? 0)) });
  }
  return career(playerId);
}
