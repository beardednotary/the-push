// Anonymous daily tallies: how many games started, finished and got shared.
// One counter hash per day ("stats:YYYY-MM-DD"); no player IDs, nothing per person.
import { store } from "./store";

export const STAT_EVENTS = [
  "five:start",
  "five:start_untimed",
  "five:finish",
  "five:share",
  "ring:start",
  "ring:finish",
  "ring:share",
  "remind:on",
] as const;
export type StatEvent = (typeof STAT_EVENTS)[number];

export const statsKey = (day: string) => `stats:${day}`;

export function countStat(day: string, field: string) {
  return store.incr(statsKey(day), field);
}

/** Count a finishing player once per day, and note whether they first played on an earlier day. */
export async function countPlayer(day: string, playerId: string) {
  const first = await store.firstSeen(playerId, day);
  if (await store.addOnce(`players:${day}`, playerId)) {
    await countStat(day, "players");
    if (first < day) await countStat(day, "returning");
  }
}

export function readStats(day: string) {
  return store.counts(statsKey(day));
}
