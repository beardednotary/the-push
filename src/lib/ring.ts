// The Immaculate Ring: a 3x3 grid; each cell wants one wrestler who fits both its row and its column.
import data from "../../data/generated/ring.json";
import { hashString, mulberry32, shuffled } from "./rng";

export interface Criterion {
  id: string;
  group: string;
  family: string;
  label: string;
  detail: string;
  count: number;
}
export interface Wrestler {
  id: number;
  name: string;
  aka: string[];
  g: string;
  tags: string[];
  pop: number;
}
export interface Grid {
  rows: Criterion[];
  cols: Criterion[];
  answerCounts: number[]; // per cell, among well-known wrestlers
}

export const GUESSES = 9;

const CRITERIA = data.criteria as Criterion[];
const WRESTLERS = data.wrestlers as Wrestler[];
const BY_ID = new Map(WRESTLERS.map((w) => [w.id, w]));
const BY_CRITERION = new Map(CRITERIA.map((c) => [c.id, c]));

// A cell is only fair if enough recognizable names fit it.
const WELL_KNOWN = WRESTLERS.filter((w) => w.pop >= 150);
const MIN_ANSWERS = 3;
// Broad buckets make lazy cells; let them in rarely.
const WEIGHT: Record<string, number> = { promotion: 3, title: 4, accolade: 3, match: 2, era: 1, life: 2.5 };
const BROAD = new Set(["wwe", "d2010s", "d2020s", "cage", "bornAbroad"]);

function weightedPick(pool: Criterion[], rand: () => number): Criterion {
  const w = pool.map((c) => (WEIGHT[c.group] ?? 1) * (BROAD.has(c.id) ? 0.3 : 1));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function fits(w: Wrestler, a: string, b: string) {
  return w.tags.includes(a) && w.tags.includes(b);
}

const cache = new Map<string, Grid>();

export function gridFor(day: string): Grid {
  const hit = cache.get(day);
  if (hit) return hit;
  const rand = mulberry32(hashString(`ring:${day}`));
  const usable = CRITERIA.filter((c) => c.count >= 8);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chosen: Criterion[] = [];
    while (chosen.length < 6) {
      const c = weightedPick(usable, rand);
      if (!chosen.some((x) => x.id === c.id || x.family === c.family)) chosen.push(c);
    }
    const [rows, cols] = [chosen.slice(0, 3), chosen.slice(3)];
    if (rows.every((c) => c.group === "era") || cols.every((c) => c.group === "era")) continue;
    const answerCounts = rows.flatMap((r) => cols.map((c) => WELL_KNOWN.filter((w) => fits(w, r.id, c.id)).length));
    if (answerCounts.every((n) => n >= MIN_ANSWERS)) {
      const grid = { rows: shuffled(rows, rand), cols: shuffled(cols, rand), answerCounts };
      grid.answerCounts = grid.rows.flatMap((r) =>
        grid.cols.map((c) => WELL_KNOWN.filter((w) => fits(w, r.id, c.id)).length),
      );
      cache.set(day, grid);
      return grid;
    }
  }
  throw new Error(`no fair grid for ${day}`);
}

/** Rebuild a grid from saved criterion ids (null if the data no longer has one of them). */
export function gridFromIds(rowIds: string[], colIds: string[]): Grid | null {
  const rows = rowIds.map((id) => BY_CRITERION.get(id));
  const cols = colIds.map((id) => BY_CRITERION.get(id));
  if (rows.some((c) => !c) || cols.some((c) => !c)) return null;
  const r = rows as Criterion[];
  const c = cols as Criterion[];
  return { rows: r, cols: c, answerCounts: r.flatMap((x) => c.map((y) => WELL_KNOWN.filter((w) => fits(w, x.id, y.id)).length)) };
}

export function cellCriteria(grid: Grid, cell: number): [Criterion, Criterion] {
  return [grid.rows[Math.floor(cell / 3)], grid.cols[cell % 3]];
}

export function checkGuess(grid: Grid, cell: number, wrestlerId: number): { correct: boolean; wrestler?: Wrestler } {
  const w = BY_ID.get(wrestlerId);
  if (!w || cell < 0 || cell > 8) return { correct: false };
  const [r, c] = cellCriteria(grid, cell);
  return { correct: fits(w, r.id, c.id), wrestler: w };
}

export function getWrestler(id: number) {
  return BY_ID.get(id);
}

export function criterion(id: string) {
  return BY_CRITERION.get(id);
}

function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

const SEARCH = WRESTLERS.map((w) => ({ w, keys: [w.name, ...w.aka].map(fold) }));

// Autocomplete over the whole pool. It never says who fits a cell.
export function searchWrestlers(q: string, limit = 8): { id: number; name: string; aka?: string }[] {
  const needle = fold(q).trim();
  if (needle.length < 2) return [];
  const scored: { w: Wrestler; s: number; via?: string }[] = [];
  for (const { w, keys } of SEARCH) {
    let best = 0;
    let via: string | undefined;
    keys.forEach((k, i) => {
      const s = k.startsWith(needle) ? 3 : k.split(" ").some((part) => part.startsWith(needle)) ? 2 : k.includes(needle) ? 1 : 0;
      if (s > best) {
        best = s;
        via = i > 0 ? w.aka[i - 1] : undefined;
      }
    });
    if (best) scored.push({ w, s: best * 1e6 + w.pop, via });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(({ w, via }) => (via ? { id: w.id, name: w.name, aka: via } : { id: w.id, name: w.name }));
}

/** Every wrestler who fits a cell, best known first. */
export function cellAnswers(grid: Grid, cell: number): Wrestler[] {
  const [r, c] = cellCriteria(grid, cell);
  return WRESTLERS.filter((w) => fits(w, r.id, c.id)); // WRESTLERS is already sorted by popularity
}
