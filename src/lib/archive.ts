// Past cards, one page per puzzle number. Only days before tonight (Eastern), so the archive
// never spoils the live card. Cards come from the frozen copy players saw; days with no frozen
// copy (before Redis, or a key that has expired) fall back to the deterministic generator.
import { frozenFive, frozenRing } from "./cards";
import { addDays, prettyDay, puzzleNumber, todayKey } from "./day";
import { questionsFor, type Question } from "./five";
import { gridFor, type Grid } from "./ring";

export interface PastDay {
  n: number;
  day: string;
}

/** The day a puzzle number ran, or null for tonight, the future, or nonsense. */
export function pastDay(n: number, today = todayKey()): PastDay | null {
  if (!Number.isInteger(n) || n < 1 || n >= puzzleNumber(today)) return null;
  return { n, day: addDays(today, n - puzzleNumber(today)) };
}

/** Every past card, newest first. */
export function pastDays(today = todayKey()): PastDay[] {
  const last = puzzleNumber(today) - 1;
  return Array.from({ length: Math.max(0, last) }, (_, i) => ({ n: last - i, day: addDays(today, -1 - i) }));
}

/** "Friday, October 16, 2026": archive pages outlive the year. */
export function datedDay(day: string): string {
  return `${prettyDay(day)}, ${day.slice(0, 4)}`;
}

/** Route params arrive as strings; only plain digits count ("012" and "1e1" don't). */
export function parseNumber(raw: string): number {
  return /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : NaN;
}

export async function pastRing(day: string): Promise<Grid> {
  return (await frozenRing(day)) ?? gridFor(day);
}

let history: { today: string; cards: Promise<(PastDay & { grid: Grid })[]> } | null = null;

/** Every past Ring grid, newest first; read once per night per server instance. */
export function ringHistory(today = todayKey()): Promise<(PastDay & { grid: Grid })[]> {
  if (history?.today !== today) {
    const cards = Promise.all(pastDays(today).map(async (d) => ({ ...d, grid: await pastRing(d.day) })));
    history = { today, cards };
    // a failed read shouldn't stick for the rest of the night
    cards.catch(() => {
      if (history?.cards === cards) history = null;
    });
  }
  return history.cards;
}

export async function pastFive(day: string): Promise<Question[]> {
  return (await frozenFive(day)) ?? questionsFor(day);
}

/** Page-safe JSON-LD: no "</script>" can break out of the tag. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
