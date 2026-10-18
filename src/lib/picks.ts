// What everyone picked in the Immaculate Ring, from the per-day pick counts.
import { picksKey } from "./cards";
import { cellAnswers, getWrestler, type Grid, type Region } from "./ring";
import { store } from "./store";

export interface CellPicks {
  total: number; // correct picks recorded for this square
  top: { name: string; pct: number }[];
  possible: number; // how many wrestlers would have counted
  examples: string[]; // well-known valid answers, for the answer key
}

export async function ringPicks(day: string, grid: Grid, examples = 0, region?: Region): Promise<CellPicks[]> {
  const counts = await store.counts(picksKey(day, region));
  return Array.from({ length: 9 }, (_, cell) => {
    const total = counts[`${cell}:total`] ?? 0;
    const top = Object.entries(counts)
      .filter(([k]) => k.startsWith(`${cell}:`) && !k.endsWith(":total"))
      .map(([k, n]) => ({ id: Number(k.split(":")[1]), n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map(({ id, n }) => ({ name: getWrestler(id)?.name ?? "Unknown", pct: total ? Math.round((100 * n) / total) : 0 }));
    const all = cellAnswers(grid, cell);
    return { total, top, possible: all.length, examples: all.slice(0, examples).map((w) => w.name) };
  });
}
