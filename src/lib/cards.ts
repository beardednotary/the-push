// Each night's card is frozen the first time anyone loads it. The question bank and
// criteria get re-imported as data is fixed; without this, a fix deployed mid-day would
// quietly swap the card under people playing it, and "yesterday" couldn't be replayed.
import { todayKey } from "./day";
import { questionsFor, type Question } from "./five";
import { gridFor, gridFromIds, type Grid } from "./ring";
import { store } from "./store";

const fiveKey = (day: string) => `card:five:${day}`;
const ringKey = (day: string) => `card:ring:${day}`;

/** Tonight's (or an earlier) Daily Five, exactly as first served. */
export async function fiveCard(day: string): Promise<Question[]> {
  const frozen = await frozenFive(day);
  if (frozen) return frozen;
  const planned = questionsFor(day);
  if (day <= todayKey()) await store.setOnce(fiveKey(day), JSON.stringify(planned));
  return (await frozenFive(day)) ?? planned;
}

export async function frozenFive(day: string): Promise<Question[] | null> {
  const raw = await store.getText(fiveKey(day));
  return raw ? (JSON.parse(raw) as Question[]) : null;
}

/** Tonight's (or an earlier) Immaculate Ring grid, exactly as first served. */
export async function ringCard(day: string): Promise<Grid> {
  const frozen = await frozenRing(day);
  if (frozen) return frozen;
  const planned = gridFor(day);
  if (day <= todayKey()) {
    await store.setOnce(ringKey(day), JSON.stringify({ rows: planned.rows.map((c) => c.id), cols: planned.cols.map((c) => c.id) }));
  }
  return (await frozenRing(day)) ?? planned;
}

export async function frozenRing(day: string): Promise<Grid | null> {
  const raw = await store.getText(ringKey(day));
  if (!raw) return null;
  const { rows, cols } = JSON.parse(raw) as { rows: string[]; cols: string[] };
  return gridFromIds(rows, cols);
}
