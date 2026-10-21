// Wrestling Wordle: one mystery star a night, eight guesses, a row of clues per guess.
// Every clue comes from ring.json tags, the same data the Ring and the fact-checkers use.
// The answer stays on the server until the game is over.
import data from "../../data/generated/ring.json";
import { addDays, todayKey } from "./day";
import { getWrestler, type Wrestler } from "./ring";
import { hashString, mulberry32 } from "./rng";
import { store } from "./store";

export const WORDLE_GUESSES = 8;
/** First night of the game; puzzle numbers are shared with the rest of the card. */
export const WORDLE_LAUNCH = "2026-10-21";
const NO_REPEAT_DAYS = 90;

export const PROMOS = ["wwe", "nxt", "wcw", "ecw", "tna", "aew"] as const;
export const PROMO_LABEL: Record<string, string> = { wwe: "WWE", nxt: "NXT", wcw: "WCW", ecw: "ECW", tna: "TNA", aew: "AEW" };
const ERAS = ["d1980s", "d1990s", "d2000s", "d2010s", "d2020s"];
const ERA_LABEL = ["'80s", "'90s", "'00s", "'10s", "'20s"];
const WORLD = ["wweChamp", "whc", "universal", "wcwChamp", "ecwChamp", "aewChamp"];
const FACTIONS: [string, string][] = [
  ["nwo", "nWo"], ["dx", "DX"], ["horsemen", "Horsemen"], ["judgmentDay", "Judgment Day"],
  ["bulletClub", "Bullet Club"], ["elite", "The Elite"], ["nexus", "Nexus"], ["ministry", "Ministry"],
];

// Stars only: names most players know (the same bar as the Ring's stars).
const POOL = (data.wrestlers as Wrestler[]).filter((w) => w.pop >= 500).sort((a, b) => a.id - b.id);

/** One wrestler's clue values, in column order. */
export interface Profile {
  promos: string[]; // ids from PROMOS
  era: number; // index into ERA_LABEL: the first decade they wrestled in our data; -1 unknown
  gender: "M" | "F";
  world: number; // how many of the six world titles (WWE, World Heavyweight, Universal, WCW, ECW, AEW)
  big: { rr: boolean; wm: boolean }; // Royal Rumble winner, WrestleMania main event
  factions: string[]; // labels
}

export function profile(w: Wrestler): Profile {
  const t = new Set(w.tags);
  return {
    promos: PROMOS.filter((p) => t.has(p)),
    era: ERAS.findIndex((e) => t.has(e)),
    gender: w.g === "f" ? "F" : "M",
    world: WORLD.filter((x) => t.has(x)).length,
    big: { rr: t.has("rumble"), wm: t.has("wmMain") },
    factions: FACTIONS.filter(([id]) => t.has(id)).map(([, label]) => label),
  };
}

export type Hit = "g" | "y" | "n"; // green match, gold close, no
export type Light = "on" | "off" | "no"; // a promotion they share, one only the guess worked, one the guess never worked

export interface Clue {
  hit: Hit;
  text: string;
  arrow?: "up" | "down"; // the answer is higher / later
}
export interface Row {
  id: number;
  name: string;
  promos: { hit: Hit; lights: Light[] };
  era: Clue;
  gender: Clue;
  world: Clue;
  big: Clue;
  faction: Clue;
}

export const eraLabel = (i: number) => ERA_LABEL[i] ?? "?";
export const bigLabel = ({ rr, wm }: Profile["big"]) => (rr && wm ? "RR+WM" : rr ? "RR" : wm ? "WM" : "—");

function overlap(a: string[], b: string[]): Hit {
  if (a.length === b.length && a.every((x) => b.includes(x))) return "g";
  return a.some((x) => b.includes(x)) ? "y" : "n";
}

function compare(a: number, b: number): Pick<Clue, "hit" | "arrow"> {
  return a === b ? { hit: "g" } : { hit: "n", arrow: b > a ? "up" : "down" };
}

/** A guess compared with the answer. */
export function clueRow(guess: Wrestler, answer: Wrestler): Row {
  const g = profile(guess);
  const a = profile(answer);
  const bigG = [g.big.rr && "rr", g.big.wm && "wm"].filter(Boolean) as string[];
  const bigA = [a.big.rr && "rr", a.big.wm && "wm"].filter(Boolean) as string[];
  const shared = g.factions.find((f) => a.factions.includes(f));
  return {
    id: guess.id,
    name: guess.name,
    promos: {
      hit: overlap(g.promos, a.promos),
      lights: PROMOS.map((p) => (!g.promos.includes(p) ? "no" : a.promos.includes(p) ? "on" : "off")),
    },
    era: { text: eraLabel(g.era), ...compare(g.era, a.era) },
    gender: { text: g.gender, hit: g.gender === a.gender ? "g" : "n" },
    world: { text: String(g.world), ...compare(g.world, a.world) },
    big: { text: bigLabel(g.big), hit: overlap(bigG, bigA) },
    faction: shared
      ? { text: shared, hit: "g" }
      : { text: g.factions[0] ?? "None", hit: !g.factions.length && !a.factions.length ? "g" : "n" },
  };
}

// ---------- the nightly pick ----------

const planned = new Map<string, number>();

/** The deterministic pick for a night, avoiding the planned picks of the 90 nights before it. */
export function plannedAnswer(day: string, avoid: ReadonlySet<number> = new Set()): number {
  const hit = planned.get(day);
  if (hit !== undefined && !avoid.has(hit)) return hit;
  // walk forward from launch so each night knows the nights before it
  const recent = new Set(avoid);
  for (let i = 1; i <= NO_REPEAT_DAYS; i++) {
    const d = addDays(day, -i);
    if (d < WORDLE_LAUNCH) break;
    recent.add(plannedAnswer(d));
  }
  const rand = mulberry32(hashString(`wordle:${day}`));
  const open = POOL.filter((w) => !recent.has(w.id));
  const id = (open.length ? open : POOL)[Math.floor(rand() * (open.length || POOL.length))].id;
  if (!avoid.size) planned.set(day, id);
  return id;
}

const cardKey = (day: string) => `card:wordle:${day}`;

export async function frozenAnswer(day: string): Promise<number | null> {
  const raw = await store.getText(cardKey(day));
  return raw && getWrestler(Number(raw)) ? Number(raw) : null;
}

/** Tonight's (or an earlier) mystery wrestler, frozen the first time anyone loads it. */
export async function wordleAnswer(day: string): Promise<Wrestler> {
  const frozen = await frozenAnswer(day);
  if (frozen) return getWrestler(frozen)!;
  // a re-imported pool can shift the plan; never repeat an answer players actually saw
  const seen = new Set<number>();
  for (let i = 1; i <= NO_REPEAT_DAYS; i++) {
    const d = addDays(day, -i);
    if (d < WORDLE_LAUNCH) break;
    const f = await frozenAnswer(d);
    if (f) seen.add(f);
  }
  const plan = plannedAnswer(day);
  const id = seen.has(plan) ? plannedAnswer(day, seen) : plan;
  if (day <= todayKey()) await store.setOnce(cardKey(day), String(id));
  return getWrestler((await frozenAnswer(day)) ?? id)!;
}

/** Replays a list of guesses: how many it took (0 if never solved) and whether the game is over. */
export function replay(guesses: number[], answer: Wrestler): { solvedIn: number; over: boolean; valid: boolean } {
  const seen = new Set<number>();
  for (let i = 0; i < guesses.length; i++) {
    const id = guesses[i];
    if (!getWrestler(id) || seen.has(id) || i >= WORDLE_GUESSES) return { solvedIn: 0, over: false, valid: false };
    seen.add(id);
    if (id === answer.id) return { solvedIn: i + 1, over: true, valid: i === guesses.length - 1 };
  }
  return { solvedIn: 0, over: guesses.length >= WORDLE_GUESSES, valid: true };
}

/** Leaderboard score: fewer guesses is higher; a miss is 0. */
export const wordleScore = (solvedIn: number) => (solvedIn ? WORDLE_GUESSES + 1 - solvedIn : 0);

/** The clue values for the fact-checkers, one line each. */
export function profileLines(w: Wrestler): string[] {
  const p = profile(w);
  return [
    `Promotions: ${p.promos.map((x) => PROMO_LABEL[x]).join(", ") || "none"}`,
    `Era (first decade wrestled): ${eraLabel(p.era)}`,
    `Gender: ${p.gender}`,
    `World titles (WWE, World Heavyweight, Universal, WCW, ECW, AEW): ${p.world}${p.world ? ` (${WORLD.filter((x) => w.tags.includes(x)).join(", ")})` : ""}`,
    `Rumble winner: ${p.big.rr ? "yes" : "no"} · WrestleMania main event: ${p.big.wm ? "yes" : "no"}`,
    `Factions: ${p.factions.join(", ") || "none"}`,
  ];
}

/** A past night's answer, as players saw it (the plan if it was never frozen). */
export async function pastWordle(day: string): Promise<Wrestler> {
  return getWrestler((await frozenAnswer(day)) ?? plannedAnswer(day))!;
}

/** Whether a night had a Wordle (it launched after the rest of the card). */
export const hadWordle = (day: string) => day >= WORDLE_LAUNCH;
