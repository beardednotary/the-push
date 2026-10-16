// Pure scoring rules, safe to import from client code (no answer data here).

export const SECONDS_PER_QUESTION = 15;

export function pointsFor(correct: boolean, ms: number): number {
  if (!correct) return 0;
  const limit = SECONDS_PER_QUESTION * 1000;
  const left = Math.max(0, Math.min(limit, limit - ms));
  return 100 + Math.round((100 * left) / limit);
}

/** Immaculate Ring leaderboard score: squares first, then lower total rarity. */
export function ringBoardLabel(score: number): string {
  const squares = Math.floor((score + 100) / 1000);
  const rarity = 900 - (score - squares * 1000);
  return `${squares}/9 · ${rarity}`;
}
