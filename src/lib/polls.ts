// Poll of the night: one question a day, one vote per player, results after you vote.
// Questions are taken in order from data/polls.json, one per day from POLL_LAUNCH, and a
// day's poll is frozen the first time it's served (like the cards), so reordering the file
// never changes a poll people already voted on. Past polls and their results live at /polls.
// Every poll also takes a write-in: those votes count as one "write-ins" bar in public, and
// the typed answers are listed only on /stats (nobody's text is shown to other players).
import list from "../../data/polls.json";
import { addDays, puzzleNumber, todayKey } from "./day";
import { store } from "./store";

export const POLL_LAUNCH = "2026-10-23";

export interface Poll {
  day: string;
  n: number; // the night's puzzle number
  question: string;
  options: string[];
}

const POLLS = list as { question: string; options: string[] }[];
const frozenKey = (day: string) => `card:poll:${day}`;
const votesKey = (day: string) => `poll:${day}`; // option index -> votes; kept for the archive
const votersKey = (day: string) => `poll:${day}:voters`;
const writeInsKey = (day: string) => `poll:${day}:writeins`; // lowercased answer -> votes

export const WRITE_IN_MAX = 40;

/** A write-in as stored: trimmed, single-spaced, lowercased, at most WRITE_IN_MAX characters. */
export function cleanWriteIn(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, WRITE_IN_MAX)
    .toLowerCase();
}

/** The planned poll for a day, or null before launch or once the list runs out. */
function planned(day: string): Poll | null {
  const i = puzzleNumber(day) - puzzleNumber(POLL_LAUNCH);
  const p = i >= 0 ? POLLS[i] : undefined;
  return p ? { day, n: puzzleNumber(day), question: p.question, options: p.options } : null;
}

/** A day's poll exactly as first served (tonight's is frozen on first read). */
export async function pollFor(day: string): Promise<Poll | null> {
  const raw = await store.getText(frozenKey(day));
  if (raw) return JSON.parse(raw) as Poll;
  const p = planned(day);
  if (p && day <= todayKey()) await store.setOnce(frozenKey(day), JSON.stringify(p));
  return p;
}

/** Votes per option, in option order, then the write-ins (index options.length). */
export async function pollCounts(poll: Poll): Promise<number[]> {
  const c = await store.hashGet(votesKey(poll.day)); // the hashBump side of the store (counts() pairs with incr, which expires)
  return [...poll.options, "write-in"].map((_, i) => Number(c[String(i)] ?? 0));
}

/** A day's write-in answers, most votes first (for /stats only). */
export async function writeIns(day: string): Promise<{ text: string; votes: number }[]> {
  return Object.entries(await store.hashGet(writeInsKey(day)))
    .map(([text, n]) => ({ text, votes: Number(n) }))
    .sort((a, b) => b.votes - a.votes || a.text.localeCompare(b.text));
}

/** Count one vote on tonight's poll (option options.length is a write-in, with its text);
 *  false when it's not a real option, a write-in is blank, or this player already voted. */
export async function vote(playerId: string, option: number, text?: unknown): Promise<{ counted: boolean; poll: Poll | null; counts: number[] }> {
  const poll = await pollFor(todayKey());
  if (!poll) return { counted: false, poll, counts: [] };
  const writeIn = option === poll.options.length ? cleanWriteIn(text) : "";
  const ok = Number.isInteger(option) && option >= 0 && (option < poll.options.length || !!writeIn);
  const counted = ok && (await store.addOnce(votersKey(poll.day), playerId));
  if (counted) await store.hashBump(votesKey(poll.day), String(option));
  if (counted && writeIn) await store.hashBump(writeInsKey(poll.day), writeIn);
  return { counted, poll, counts: await pollCounts(poll) };
}

/** Every past poll, newest first (tonight's stays off the shelf until midnight). */
export async function pastPolls(today = todayKey()): Promise<{ poll: Poll; counts: number[] }[]> {
  const out: { poll: Poll; counts: number[] }[] = [];
  for (let day = addDays(today, -1); day >= POLL_LAUNCH; day = addDays(day, -1)) {
    const poll = await pollFor(day);
    if (poll) out.push({ poll, counts: await pollCounts(poll) });
  }
  return out;
}
