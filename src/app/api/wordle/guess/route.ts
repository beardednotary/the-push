import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { getWrestler } from "@/lib/ring";
import { clueRow, replay, twins, wordleAnswer } from "@/lib/wordle";

// POST {guesses: wrestler ids so far, newest last}: the clue row for the newest guess.
// The answer only comes back once the game is over (solved, or eight different guesses).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const guesses: number[] = Array.isArray(body.guesses) ? body.guesses.slice(0, 9).map(Number) : [];
  const day = todayKey();
  const answer = await wordleAnswer(day);
  const { solvedIn, over, valid } = replay(guesses, answer);
  const last = getWrestler(guesses[guesses.length - 1]);
  if (!valid || !last) return NextResponse.json({ error: "bad guesses" }, { status: 400 });
  const row = clueRow(last, answer, day);
  const hits = [row.promos.hit, row.era.hit, row.gender.hit, row.world.hit, row.big.hit, row.faction.hit];
  // all green but not them: say so, or it looks like a win that never comes
  if (last.id !== answer.id && hits.every((h) => h === "g")) row.twins = twins(answer, day);
  return NextResponse.json({
    row,
    solved: solvedIn > 0,
    answer: over ? clueRow(answer, answer, day) : undefined,
  });
}
