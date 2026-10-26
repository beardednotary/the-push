// Anonymous daily tallies: how many games started, finished and got shared.
// One counter hash per day ("stats:YYYY-MM-DD"); no player IDs, nothing per person.
import { store } from "./store";

export const STAT_EVENTS = [
  "five:start",
  "five:start_untimed",
  "five:finish",
  "five:share",
  "five:share_tap", // tapped Challenge a friend, whether or not they went through with it
  "ring:start",
  "ring:finish",
  "ring:share",
  "ring:share_tap",
  "ringjp:start",
  "ringjp:finish",
  "ringjp:share",
  "ringjp:share_tap",
  "wordle:start",
  "wordle:finish",
  "wordle:share",
  "wordle:share_tap",
  "five:story", // shared the 9:16 story image
  "five:story_tap",
  "ring:story",
  "ring:story_tap",
  "wordle:story",
  "wordle:story_tap",
  // someone opened a shared link (utm_source=share), by the game or poll that sent it
  "five:arrive",
  "ring:arrive",
  "ringjp:arrive",
  "wordle:arrive",
  "poll:arrive",
  "poll:vote",
  "remind:on",
  "league:create", // counted on the server when a friend league starts
  "league:join", // a player joined someone else's league (the owner's own join isn't counted)
] as const;
// Also counted, but only by the server (not postable here): "ring:dispute", a player disputing a rejected Ring guess.
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
