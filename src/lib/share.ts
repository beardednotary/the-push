// A shared result lives in its URL: /r/five/<no>/<code> or /r/ring/<no>/<code>.
// Codes are strictly validated, so no free text ever reaches a share image.
//   five: "742-GGRYX"     score 0-1000, then one mark per question
//         G right and fast · Y right but slow · R wrong · X time ran out
//   ring: "120-110011101"  rarity 0-900, then nine cells (1 filled, 0 empty), row by row

export type Mark = "G" | "Y" | "R" | "X";

export interface FiveResult {
  game: "five";
  number: number;
  score: number;
  marks: Mark[];
}
export interface RingResult {
  game: "ring";
  number: number;
  rarity: number;
  cells: boolean[];
  squares: number;
}
export type SharedResult = FiveResult | RingResult;

export function fiveCode(score: number, marks: Mark[]) {
  return `${score}-${marks.join("")}`;
}

export function ringCode(rarity: number, cells: boolean[]) {
  return `${rarity}-${cells.map((c) => (c ? "1" : "0")).join("")}`;
}

export function sharePath(game: "five" | "ring", number: number, code: string) {
  return `/r/${game}/${number}/${code}`;
}

export function parseResult(game: string, n: string, code: string): SharedResult | null {
  const number = Number(n);
  if (!/^\d{1,5}$/.test(n) || number < 1) return null;
  if (game === "five") {
    const m = /^(\d{1,4})-([GYRX]{5})$/.exec(code);
    if (!m || Number(m[1]) > 1000) return null;
    return { game, number, score: Number(m[1]), marks: m[2].split("") as Mark[] };
  }
  if (game === "ring") {
    const m = /^(\d{1,3})-([01]{9})$/.exec(code);
    if (!m || Number(m[1]) > 900) return null;
    const cells = m[2].split("").map((c) => c === "1");
    return { game, number, rarity: Number(m[1]), cells, squares: cells.filter(Boolean).length };
  }
  return null;
}

export const MARK_COLOR: Record<Mark, string> = { G: "#22d17a", Y: "#ffd400", R: "#e8112d", X: "#2a2f3c" };
export const MARK_EMOJI: Record<Mark, string> = { G: "🟩", Y: "🟨", R: "🟥", X: "⬛" };

export function headline(r: SharedResult) {
  return r.game === "five"
    ? `${r.score} on Daily Five No. ${r.number}`
    : `${r.squares}/9 on Immaculate Ring No. ${r.number}`;
}
