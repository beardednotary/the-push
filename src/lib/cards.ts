// Each night's card is frozen the first time anyone loads it. The question bank and
// criteria get re-imported as data is fixed; without this, a fix deployed mid-day would
// quietly swap the card under people playing it, and "yesterday" couldn't be replayed.
import { todayKey } from "./day";
import { questionsFor, type Question } from "./five";
import { gridFor, gridFromIds, type Grid, type Region } from "./ring";
import { store } from "./store";

const fiveKey = (day: string) => `card:five:${day}`;
// region cards: card:ring:jp:DAY next to the main card:ring:DAY
const ringKey = (day: string, region?: Region) => (region ? `card:ring:${region}:${day}` : `card:ring:${day}`);
/** Where a Ring card's correct picks are counted (for rarity). */
export const picksKey = (day: string, region?: Region) => (region ? `ring:${region}:${day}:picks` : `ring:${day}:picks`);

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
export async function ringCard(day: string, region?: Region): Promise<Grid> {
  const frozen = await frozenRing(day, region);
  if (frozen) return frozen;
  const planned = gridFor(day, region);
  if (day <= todayKey()) {
    await store.setOnce(ringKey(day, region), JSON.stringify({ rows: planned.rows.map((c) => c.id), cols: planned.cols.map((c) => c.id) }));
  }
  return (await frozenRing(day, region)) ?? planned;
}

export async function frozenRing(day: string, region?: Region): Promise<Grid | null> {
  const raw = await store.getText(ringKey(day, region));
  if (!raw) return null;
  const { rows, cols } = JSON.parse(raw) as { rows: string[]; cols: string[] };
  return gridFromIds(rows, cols);
}
