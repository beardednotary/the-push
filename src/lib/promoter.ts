// Promoter: share links carry a short code for the sharer (?by=), and when a brand-new
// player arrives through one and finishes their first game, the sharer gets the credit.
// One recruit earns Promoter; ten earn Top Draw. The code is a hash of the player ID, so
// a link never reveals the ID itself.
import { createHash } from "node:crypto";
import { store } from "./store";

const CODES = "ref:code"; // code -> sharer playerId
const RECRUITS = "ref:recruits"; // sharer playerId -> recruits who finished a game
const RECRUITED_BY = "ref:by"; // recruit playerId -> sharer playerId

export const refCode = (playerId: string) => createHash("sha256").update(playerId).digest("hex").slice(0, 8);
export const cleanRef = (raw: unknown) => (/^[0-9a-f]{8}$/.test(String(raw ?? "")) ? String(raw) : null);

export function promoterTitle(recruits: number): string | null {
  return recruits >= 10 ? "Top Draw" : recruits >= 1 ? "Promoter" : null;
}

/** Remember which player a code belongs to; called when they share. */
export async function registerRef(playerId: string): Promise<string> {
  const code = refCode(playerId);
  await store.hashSet(CODES, { [code]: playerId });
  return code;
}

/** A player's first finished game came through a share link: credit the sharer. */
export async function creditRecruit(recruit: string, ref: string) {
  const sharer = (await store.hashGet(CODES))[ref];
  if (!sharer || sharer === recruit) return;
  await store.hashSet(RECRUITED_BY, { [recruit]: sharer });
  await store.hashBump(RECRUITS, sharer);
}

/** playerId -> recruits, for everyone with at least one */
export async function recruitCounts(): Promise<Record<string, number>> {
  const all = await store.hashGet(RECRUITS);
  return Object.fromEntries(Object.entries(all).map(([id, n]) => [id, Number(n)]));
}
