// Hand-given flair. Road Agent: the backstage producer who keeps matches clean, for
// players whose reports led to a fix. Granted from /stats with the player's code.
import { store } from "./store";

export const FLAIR: Record<string, string> = { "road-agent": "Road Agent" };
const KEY = "flair"; // playerId -> flair id

/** The short code a signed-in player sends to get flair: the start of their player ID. */
export const playerCode = (playerId: string) => playerId.replace(/-/g, "").slice(0, 8).toUpperCase();

/** playerId -> flair label */
export async function flairs(): Promise<Record<string, string>> {
  const all = await store.hashGet(KEY);
  return Object.fromEntries(Object.entries(all).filter(([, f]) => FLAIR[f]).map(([id, f]) => [id, FLAIR[f]]));
}

/** Give (or with flair "" take away) flair by player code. Only signed-in players have a code. */
export async function setFlair(code: string, flair: string): Promise<string | null> {
  const want = code.replace(/[^0-9a-z]/gi, "").toUpperCase();
  if (want.length !== 8) return null;
  const links = await store.hashGet("account:player"); // userId -> playerId
  const playerId = Object.values(links).find((p) => playerCode(String(p)) === want);
  if (!playerId) return null;
  await store.hashSet(KEY, { [String(playerId)]: flair });
  return String(playerId);
}

/** Give flair straight to a player ID (accepted disputes); never replaces flair they already have. */
export async function grantFlair(playerId: string, flair: string) {
  if (!(await store.hashGet(KEY))[playerId]) await store.hashSet(KEY, { [playerId]: flair });
}
