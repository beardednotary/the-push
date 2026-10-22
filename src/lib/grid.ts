// The grid guide (/grid): one page per Ring category and one per pair of categories, listing
// every wrestler who fits. These are the pages people land on from "wrestlers who were X and Y".
// A pair on tonight's live grid keeps its list locked until midnight Eastern.
import { ringCard } from "./cards";
import { todayKey } from "./day";
import { LIVE_REGIONS } from "./regions";
import { allCriteria, criterion, wrestlersWith, type Criterion } from "./ring";

/** A pair page is indexed (and in the sitemap) from this many answers; thinner ones exist but stay out of search. */
export const MIN_INDEXED = 5;

// Grid plates are short; search wants the full name.
const LONG: Record<string, string> = {
  wweChamp: "WWE Champion",
  whc: "World Heavyweight Champion",
  ic: "Intercontinental Champion",
  us: "United States Champion",
  tv: "TV Champion",
  cruiser: "Cruiserweight Champion",
  rumble: "Royal Rumble Winner",
  wmMain: "WrestleMania Main Event",
  aewPpvMain: "AEW PPV Main Event",
  hiac: "Hell in a Cell",
  marathon: "30-Minute Singles Match",
  iwgpChamp: "IWGP Heavyweight Champion",
  never: "NEVER Openweight Champion",
  iwgpJr: "IWGP Junior Heavyweight Champion",
  ghc: "GHC Heavyweight Champion",
  stardomChamp: "World of Stardom Champion",
  bosj: "Best of the Super Juniors Winner",
  cover: "WWE 2K Cover Star",
};

/** The category's full name, without the soft hyphens the grid plates use. */
export function longName(c: Criterion): string {
  return LONG[c.id] ?? c.label.replace(/­/g, "");
}

// URL slugs come from the full name ("World Heavyweight Champion" -> world-heavyweight-champion).
// Renaming a category changes its URL, so keep LONG stable once pages are indexed.
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const BY_SLUG = new Map<string, Criterion>();
const SLUG = new Map<string, string>();
for (const c of allCriteria()) {
  const s = slugify(longName(c));
  if (BY_SLUG.has(s)) throw new Error(`grid slug ${s} is taken twice`);
  BY_SLUG.set(s, c);
  SLUG.set(c.id, s);
}

export const slugOf = (c: Criterion) => SLUG.get(c.id)!;
export const fromSlug = (s: string) => BY_SLUG.get(s);

const ORDER = new Map(allCriteria().map((c, i) => [c.id, i]));

/** The two categories in canonical (import) order, so each pair has one URL. */
export function ordered(a: Criterion, b: Criterion): [Criterion, Criterion] {
  return ORDER.get(a.id)! <= ORDER.get(b.id)! ? [a, b] : [b, a];
}

export function categoryHref(c: Criterion): string {
  return `/grid/${slugOf(c)}`;
}

export function pairHref(a: Criterion | string, b: Criterion | string): string {
  const [x, y] = ordered(typeof a === "string" ? criterion(a)! : a, typeof b === "string" ? criterion(b)! : b);
  return `/grid/${slugOf(x)}/${slugOf(y)}`;
}

/** Two categories the grid could ever pair: different, and not from the same family. */
export function pairable(a: Criterion, b: Criterion): boolean {
  return a.id !== b.id && a.family !== b.family;
}

export interface Pair {
  a: Criterion;
  b: Criterion;
  count: number;
}

let pairs: Pair[] | null = null;

/** Every pairable couple with at least one answer (from the import, not live overrides), biggest first. */
export function allPairs(): Pair[] {
  if (pairs) return pairs;
  const cs = allCriteria();
  const holders = new Map(cs.map((c) => [c.id, new Set(wrestlersWith([c.id]).map((w) => w.id))]));
  const out: Pair[] = [];
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      if (!pairable(cs[i], cs[j])) continue;
      const [small, big] = [holders.get(cs[i].id)!, holders.get(cs[j].id)!].sort((x, y) => x.size - y.size);
      let count = 0;
      for (const id of small) if (big.has(id)) count++;
      if (count) out.push({ a: cs[i], b: cs[j], count });
    }
  }
  pairs = out.sort((x, y) => y.count - x.count);
  return pairs;
}

/** Pairs that include this category, biggest first. */
export function pairsWith(c: Criterion, min = 1): Pair[] {
  return allPairs().filter((p) => (p.a.id === c.id || p.b.id === c.id) && p.count >= min);
}

/** The other category of a pair. */
export function partner(p: Pair, c: Criterion): Criterion {
  return p.a.id === c.id ? p.b : p.a;
}

/** Is this pair a square on one of tonight's live grids? Its answers wait for midnight. */
export async function onTonight(a: Criterion, b: Criterion): Promise<boolean> {
  const day = todayKey();
  const grids = await Promise.all([ringCard(day), ...LIVE_REGIONS.map((r) => ringCard(day, r))]);
  return grids.some((g) => g.rows.some((r) => g.cols.some((c) => (r.id === a.id && c.id === b.id) || (r.id === b.id && c.id === a.id))));
}
