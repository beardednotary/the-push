// The Immaculate Ring: a 3x3 grid; each cell wants one wrestler who fits both its row and its column.
import data from "../../data/generated/ring.json";
import { REGIONS, type Region } from "./regions";
import { hashString, mulberry32, shuffled } from "./rng";

export { REGIONS, isRegion, type Region } from "./regions";

export interface Criterion {
  id: string;
  group: string;
  family: string;
  label: string;
  detail: string;
  count: number;
  scene?: string; // "jp" / "mx": a Japan or Mexico criterion, kept out of the main grid for now
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
// place (nationality, birth state) and faction have many small criteria, so each weighs little.
// Each shares one family, so a card has at most one faction and one place.
const WEIGHT: Record<string, number> = { promotion: 3, title: 4, accolade: 3, match: 2, era: 1, life: 2.5, place: 1.2, name: 2.5, faction: 1.2 };
const MAX_TITLES = 2;
const BROAD = new Set(["wwe", "d2010s", "d2020s", "cage", "bornAbroad", "neverNxt"]);

function weightedPick(pool: Criterion[], rand: () => number): Criterion {
  const w = pool.map((c) => (WEIGHT[c.group] ?? 1) * (BROAD.has(c.id) ? 0.3 : 1));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Tags added live from accepted player disputes ("wrestlerId:criterionId"), until the data catches up. */
export type Overrides = ReadonlySet<string>;

function has(w: Wrestler, tag: string, extra?: Overrides) {
  return w.tags.includes(tag) || Boolean(extra?.has(`${w.id}:${tag}`));
}

function fits(w: Wrestler, a: string, b: string, extra?: Overrides) {
  return has(w, a, extra) && has(w, b, extra);
}

/** The criteria of a cell this wrestler lacks (what a dispute is about). */
export function missing(grid: Grid, cell: number, wrestlerId: number, extra?: Overrides): Criterion[] {
  const w = BY_ID.get(wrestlerId);
  if (!w || cell < 0 || cell > 8) return [];
  return cellCriteria(grid, cell).filter((c) => !has(w, c.id, extra));
}

const cache = new Map<string, Grid>();

// Region cards: a separate daily grid per scene, built only from that scene's belts and
// tournaments plus life facts (MMA, amateur...). No US promotions, no eras (they count US
// matches only) and no birthplace (too many Japanese stars have none on Wikidata).
export function gridFor(day: string, region?: Region): Grid {
  const key = region ? `${region}:${day}` : day;
  const hit = cache.get(key);
  if (hit) return hit;
  const grid = region ? buildRegion(day, region) : buildMain(day);
  cache.set(key, grid);
  return grid;
}

function buildRegion(day: string, region: Region): Grid {
  const rand = mulberry32(hashString(`ring:${region}:${day}`));
  const scene = CRITERIA.filter((c) => c.scene === region);
  const ids = new Set(scene.map((c) => c.id));
  // fairness counts everyone with one of the scene's belts or tournaments; US popularity means nothing here
  const known = WRESTLERS.filter((w) => w.tags.some((t) => ids.has(t)));
  const count = (id: string) => known.filter((w) => w.tags.includes(id)).length;
  const usable = CRITERIA.filter((c) => (c.scene === region || (c.group === "life" && !c.id.startsWith("born"))) && count(c.id) >= 8);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chosen: Criterion[] = [];
    for (let tries = 0; chosen.length < 6 && tries < 200; tries++) {
      const c = weightedPick(usable, rand);
      if (!chosen.some((x) => x.id === c.id || x.family === c.family)) chosen.push(c);
    }
    if (chosen.length < 6 || chosen.filter((c) => c.scene).length < REGIONS[region].sceneMin) continue;
    const [rows, cols] = [chosen.slice(0, 3), chosen.slice(3)];
    // every square has at least one of the scene's own belts: never "Amateur x MMA"
    if (!rows.every((c) => c.scene) && !cols.every((c) => c.scene)) continue;
    const answerCounts = rows.flatMap((r) => cols.map((c) => known.filter((w) => fits(w, r.id, c.id)).length));
    if (answerCounts.every((n) => n >= MIN_ANSWERS)) {
      const g = { rows: shuffled(rows, rand), cols: shuffled(cols, rand), answerCounts: [] as number[] };
      g.answerCounts = g.rows.flatMap((r) => g.cols.map((c) => known.filter((w) => fits(w, r.id, c.id)).length));
      return g;
    }
  }
  throw new Error(`no fair ${region} grid for ${day}`);
}

// From this day on, grids are built easier (see docs/ring-difficulty.md). Earlier days keep
// the old builder so any card that was never frozen still comes out the same.
const EASIER_FROM = "2026-10-20";
// Stars: names most players know. Every square needs some of them, not just well-known names.
const STARS = WRESTLERS.filter((w) => w.pop >= 500);
const MIN_STARS = 2;
// A square with fewer stars than this is hard. At most three a grid: about one tough row or column.
const HARD_STARS = 5;
const MAX_HARD = 3;
const starCount = new Map(CRITERIA.map((c) => [c.id, STARS.filter((w) => w.tags.includes(c.id)).length]));
// Players leave these blank even when plenty of stars fit (docs/ring-difficulty.md): one per grid at most.
const OBSCURE = new Set(["tv", "cruiser", "profootball"]);
const isNarrow = (c: Criterion) => OBSCURE.has(c.id) || (starCount.get(c.id) ?? 0) < 12; // e.g. a birth state, a faction
const isWide = (c: Criterion) => (starCount.get(c.id) ?? 0) >= 40; // e.g. WCW, Actor, IC Champion

function buildMain(day: string): Grid {
  return day < EASIER_FROM ? buildMainV1(day) : buildMainV2(day);
}

function buildMainV2(day: string): Grid {
  const rand = mulberry32(hashString(`ring:${day}`));
  const usable = CRITERIA.filter((c) => c.count >= 8 && !c.scene);
  const cells = (rows: Criterion[], cols: Criterion[], pool: Wrestler[]) =>
    rows.flatMap((r) => cols.map((c) => pool.filter((w) => fits(w, r.id, c.id)).length));
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chosen: Criterion[] = [];
    while (chosen.length < 6) {
      const c = weightedPick(usable, rand);
      if (chosen.some((x) => x.id === c.id || x.family === c.family)) continue;
      // keep the grid varied: at most two belts per card
      if (c.group === "title" && chosen.filter((x) => x.group === "title").length >= MAX_TITLES) continue;
      chosen.push(c);
    }
    const [rows, cols] = [chosen.slice(0, 3), chosen.slice(3)];
    if (rows.every((c) => c.group === "era") || cols.every((c) => c.group === "era")) continue;
    if (chosen.filter((c) => OBSCURE.has(c.id)).length > 1) continue;
    // every row meets every column, so narrow categories may sit on one side only
    if (rows.some(isNarrow) && cols.some(isNarrow)) continue;
    // one row and one column everybody can fill from memory
    if (!rows.some(isWide) || !cols.some(isWide)) continue;
    const stars = cells(rows, cols, STARS);
    if (stars.some((n) => n < MIN_STARS) || stars.filter((n) => n < HARD_STARS).length > MAX_HARD) continue;
    if (cells(rows, cols, WELL_KNOWN).some((n) => n < MIN_ANSWERS)) continue;
    const g = { rows: shuffled(rows, rand), cols: shuffled(cols, rand), answerCounts: [] as number[] };
    g.answerCounts = cells(g.rows, g.cols, WELL_KNOWN);
    return g;
  }
  throw new Error(`no fair grid for ${day}`);
}

function buildMainV1(day: string): Grid {
  const rand = mulberry32(hashString(`ring:${day}`));
  const usable = CRITERIA.filter((c) => c.count >= 8 && !c.scene);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chosen: Criterion[] = [];
    while (chosen.length < 6) {
      const c = weightedPick(usable, rand);
      if (chosen.some((x) => x.id === c.id || x.family === c.family)) continue;
      // keep the grid varied: at most two belts per card
      if (c.group === "title" && chosen.filter((x) => x.group === "title").length >= MAX_TITLES) continue;
      chosen.push(c);
    }
    const [rows, cols] = [chosen.slice(0, 3), chosen.slice(3)];
    if (rows.every((c) => c.group === "era") || cols.every((c) => c.group === "era")) continue;
    const answerCounts = rows.flatMap((r) => cols.map((c) => WELL_KNOWN.filter((w) => fits(w, r.id, c.id)).length));
    if (answerCounts.every((n) => n >= MIN_ANSWERS)) {
      const grid = { rows: shuffled(rows, rand), cols: shuffled(cols, rand), answerCounts };
      grid.answerCounts = grid.rows.flatMap((r) =>
        grid.cols.map((c) => WELL_KNOWN.filter((w) => fits(w, r.id, c.id)).length),
      );
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

export function checkGuess(grid: Grid, cell: number, wrestlerId: number, extra?: Overrides): { correct: boolean; wrestler?: Wrestler } {
  const w = BY_ID.get(wrestlerId);
  if (!w || cell < 0 || cell > 8) return { correct: false };
  const [r, c] = cellCriteria(grid, cell);
  return { correct: fits(w, r.id, c.id, extra), wrestler: w };
}

export function getWrestler(id: number) {
  return BY_ID.get(id);
}

/** Look a wrestler up by name or alias, folded (for the fact-check sheets). */
export function wrestlerByName(name: string): Wrestler | undefined {
  const k = fold(name).trim();
  return SEARCH.find(({ keys }) => keys.includes(k))?.w;
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
export function cellAnswers(grid: Grid, cell: number, extra?: Overrides): Wrestler[] {
  const [r, c] = cellCriteria(grid, cell);
  return WRESTLERS.filter((w) => fits(w, r.id, c.id, extra)); // WRESTLERS is already sorted by popularity
}
