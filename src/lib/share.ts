// A shared result lives in its URL: /r/five/<no>/<code> or /r/ring/<no>/<code>.
// Codes are strictly validated, so no free text ever reaches a share image.
//   five: "742-GGRYX"     score 0-1000, then one mark per question; a trailing "u" marks an untimed game (max 500)
//         G right and fast · Y right but slow · R wrong · X time ran out
//   ring: "120-110011101"  rarity 0-900, then nine cells (1 filled, 0 empty), row by row
//   wordle: "3-YNNNYG.YGGNNN.GGGGGG"  guesses it took (x for a miss), then one row per guess:
//         six clue colors, G green · Y gold · N no

export type Mark = "G" | "Y" | "R" | "X";

export interface FiveResult {
  game: "five";
  number: number;
  score: number;
  marks: Mark[];
  untimed: boolean;
}
export interface RingResult {
  game: "ring";
  number: number;
  rarity: number;
  cells: boolean[];
  squares: number;
}
export interface WordleResult {
  game: "wordle";
  number: number;
  solvedIn: number; // 0: missed
  rows: Hit[][];
}
export type Hit = "G" | "Y" | "N";
export type SharedResult = FiveResult | RingResult | WordleResult;

export function fiveCode(score: number, marks: Mark[], untimed = false) {
  return `${score}-${marks.join("")}${untimed ? "u" : ""}`;
}

export function ringCode(rarity: number, cells: boolean[]) {
  return `${rarity}-${cells.map((c) => (c ? "1" : "0")).join("")}`;
}

export function wordleCode(solvedIn: number, rows: Hit[][]) {
  return `${solvedIn || "x"}-${rows.map((r) => r.join("")).join(".")}`;
}

export function sharePath(game: "five" | "ring" | "wordle", number: number, code: string) {
  return `/r/${game}/${number}/${code}`;
}

export function parseResult(game: string, n: string, code: string): SharedResult | null {
  const number = Number(n);
  if (!/^\d{1,5}$/.test(n) || number < 1) return null;
  if (game === "five") {
    const m = /^(\d{1,4})-([GYRX]{5})(u?)$/.exec(code);
    const untimed = m?.[3] === "u";
    if (!m || Number(m[1]) > (untimed ? 500 : 1000)) return null;
    return { game, number, score: Number(m[1]), marks: m[2].split("") as Mark[], untimed };
  }
  if (game === "ring") {
    const m = /^(\d{1,3})-([01]{9})$/.exec(code);
    if (!m || Number(m[1]) > 900) return null;
    const cells = m[2].split("").map((c) => c === "1");
    return { game, number, rarity: Number(m[1]), cells, squares: cells.filter(Boolean).length };
  }
  if (game === "wordle") {
    const m = /^([1-8]|x)-([GYN]{6}(?:\.[GYN]{6}){0,7})$/.exec(code);
    if (!m) return null;
    const rows = m[2].split(".").map((r) => r.split("") as Hit[]);
    const solvedIn = m[1] === "x" ? 0 : Number(m[1]);
    // a win is the last row, all green; a miss is all eight rows
    if (solvedIn ? solvedIn !== rows.length || rows[rows.length - 1].some((h) => h !== "G") : rows.length !== 8) return null;
    return { game, number, solvedIn, rows };
  }
  return null;
}

export const HIT_COLOR: Record<Hit, string> = { G: "#22d17a", Y: "#ffd400", N: "#2a3040" };
export const HIT_EMOJI: Record<Hit, string> = { G: "🟩", Y: "🟨", N: "⬛" };

export const MARK_COLOR: Record<Mark, string> = { G: "#22d17a", Y: "#ffd400", R: "#e8112d", X: "#2a2f3c" };
export const MARK_EMOJI: Record<Mark, string> = { G: "🟩", Y: "🟨", R: "🟥", X: "⬛" };

export function headline(r: SharedResult) {
  if (r.game === "wordle") return `${r.solvedIn ? `${r.solvedIn}/8` : "X/8"} on Wrestling Wordle No. ${r.number}`;
  return r.game === "five"
    ? `${r.score} on Daily Five No. ${r.number}${r.untimed ? " (untimed)" : ""}`
    : `${r.squares}/9 on Immaculate Ring No. ${r.number}`;
}
